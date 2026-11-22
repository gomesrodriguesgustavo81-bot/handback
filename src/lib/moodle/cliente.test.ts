import { afterEach, describe, expect, it, vi } from "vitest";
import {
  achatar,
  baixarArquivo,
  chamar,
  dataDoMoodle,
  ErroMoodle,
  htmlParaTexto,
  infoDoSite,
  ipProibido,
  normalizarSite,
  notaDoConceito,
  pedirChave,
  textoParaHtml,
} from "./cliente";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function respostaJson(j: unknown, status = 200) {
  return new Response(JSON.stringify(j), { status, headers: { "content-type": "application/json" } });
}

describe("endereço do Moodle", () => {
  it("arruma o que a pessoa digita", () => {
    expect(normalizarSite("ava.Faculdade.edu.br")).toBe("https://ava.faculdade.edu.br");
    expect(normalizarSite("https://ava.faculdade.edu.br/login/index.php")).toBe("https://ava.faculdade.edu.br");
    expect(normalizarSite("http://ava.faculdade.edu.br/my/")).toBe("https://ava.faculdade.edu.br");
    expect(normalizarSite("https://portal.edu.br/moodle/course/view.php?id=3")).toBe("https://portal.edu.br/moodle");
  });
  it("recusa endereços estranhos", () => {
    expect(() => normalizarSite("")).toThrow(ErroMoodle);
    expect(() => normalizarSite("rodrigues@usp.br")).toThrow(/Isso é um e-mail/);
    expect(() => normalizarSite("ftp://ava.edu.br")).toThrow(/https/);
    expect(() => normalizarSite("https://eu:senha@ava.edu.br")).toThrow(/sem usuário/);
  });
  it("nunca chama a rede interna", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.10", "172.20.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(ipProibido(ip), ip).toBe(true);
    }
    for (const ip of ["200.18.1.10", "8.8.8.8", "2804:14c::1"]) expect(ipProibido(ip), ip).toBe(false);
  });
  it("recusa um endereço que aponta para dentro", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(chamar("https://127.0.0.1", "x", "core_webservice_get_site_info")).rejects.toThrow(/não pode ser usado/);
    await expect(chamar("https://localhost", "x", "core_webservice_get_site_info")).rejects.toThrow(/não pode ser usado/);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("conversa com o Moodle", () => {
  it("monta os parâmetros no formato do Moodle", () => {
    const p = achatar({ courseids: [3, 4], plugindata: { assignfeedbackcomments_editor: { text: "Oi", format: 1 } }, applytoall: true });
    expect(p.toString()).toBe(
      "courseids%5B0%5D=3&courseids%5B1%5D=4&plugindata%5Bassignfeedbackcomments_editor%5D%5Btext%5D=Oi&plugindata%5Bassignfeedbackcomments_editor%5D%5Bformat%5D=1&applytoall=1",
    );
  });
  it("troca a senha pela chave e explica os erros", async () => {
    vi.stubEnv("HANDBACK_MOODLE_LOCAL", "1");
    const f = vi.fn().mockResolvedValueOnce(respostaJson({ token: "abc123" }));
    vi.stubGlobal("fetch", f);
    await expect(pedirChave("http://moodle.test", "ana", "s3nha")).resolves.toBe("abc123");
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe("http://moodle.test/login/token.php");
    expect(String(init.body)).toContain("service=moodle_mobile_app");
    expect(init.redirect).toBe("manual");

    f.mockResolvedValueOnce(respostaJson({ error: "Invalid login", errorcode: "invalidlogin" }));
    await expect(pedirChave("http://moodle.test", "ana", "x")).rejects.toThrow("Usuário ou senha do Moodle incorretos.");
    f.mockResolvedValueOnce(respostaJson({ error: "x", errorcode: "enablewsdescription" }));
    await expect(pedirChave("http://moodle.test", "ana", "x")).rejects.toThrow(/serviço para dispositivos móveis/);
    f.mockResolvedValueOnce(new Response("<html>oi</html>"));
    await expect(pedirChave("http://moodle.test", "ana", "x")).rejects.toThrow(/não parece ser de um Moodle/);
    f.mockResolvedValueOnce(new Response(null, { status: 303, headers: { location: "https://novo.moodle.test/login" } }));
    await expect(pedirChave("http://moodle.test", "ana", "x")).rejects.toThrow(/https:\/\/novo\.moodle\.test/);
  });
  it("avisa quando a chave expirou", async () => {
    vi.stubEnv("HANDBACK_MOODLE_LOCAL", "1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respostaJson({ exception: "moodle_exception", errorcode: "invalidtoken", message: "Invalid token" })));
    const erro = (await chamar("http://moodle.test", "x", "core_webservice_get_site_info").catch((e: unknown) => e)) as ErroMoodle;
    expect(erro).toBeInstanceOf(ErroMoodle);
    expect(erro.reconectar).toBe(true);
  });
  it("confere se o Moodle libera tudo o que é preciso", async () => {
    vi.stubEnv("HANDBACK_MOODLE_LOCAL", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respostaJson({ sitename: "AVA", fullname: "Ana", userid: 2, functions: [{ name: "core_webservice_get_site_info" }] })),
    );
    await expect(infoDoSite("http://moodle.test", "x")).rejects.toThrow(/mod_assign_save_grade/);
  });
  it("só baixa arquivos do próprio Moodle", async () => {
    vi.stubEnv("HANDBACK_MOODLE_LOCAL", "1");
    const f = vi.fn().mockResolvedValue(new Response("pdf"));
    vi.stubGlobal("fetch", f);
    await expect(baixarArquivo("http://moodle.test", "k", "http://outro.test/arquivo.pdf")).rejects.toThrow(/fora do Moodle/);
    const dados = await baixarArquivo("http://moodle.test", "k", "http://moodle.test/webservice/pluginfile.php/1/a.pdf");
    expect(dados.toString()).toBe("pdf");
    expect(String(f.mock.calls[0][0])).toContain("token=k");
  });
});

describe("textos e notas", () => {
  it("HTML do Moodle vira texto", () => {
    expect(htmlParaTexto("<p>Segue o <b>link</b>&nbsp;do Figma</p><ul><li>um</li><li>dois</li></ul>")).toBe("Segue o link do Figma\n• um\n• dois");
  });
  it("devolutiva vira HTML seguro", () => {
    expect(textoParaHtml("Boa entrega!\n\nPróxima: <mais> testes\nvaleu", "BOM")).toBe(
      "<p><strong>Conceito: BOM</strong></p><p>Boa entrega!</p><p>Próxima: &lt;mais&gt; testes<br>valeu</p>",
    );
  });
  it("conceito vira nota", () => {
    expect(notaDoConceito(10, 80)).toBe(8);
    expect(notaDoConceito(100, 85)).toBe(85);
    expect(notaDoConceito(7.5, 60)).toBe(4.5);
    expect(notaDoConceito(null, 80)).toBeNull();
    expect(notaDoConceito(-3, 80)).toBeNull();
    expect(notaDoConceito(10, undefined)).toBeNull();
  });
  it("datas no horário de Brasília", () => {
    expect(dataDoMoodle(Date.UTC(2025, 8, 30, 0, 0) / 1000)).toBe("2025-09-29"); // 30/09 00:00 UTC = 29/09 21:00 em Brasília
    expect(dataDoMoodle(0)).toBeNull();
  });
});
