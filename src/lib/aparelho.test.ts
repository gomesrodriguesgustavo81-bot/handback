import { describe, expect, it } from "vitest";
import { descreverAparelho } from "./aparelho";

describe("descreverAparelho", () => {
  it("reconhece os mais comuns", () => {
    expect(descreverAparelho("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")).toBe("Chrome no Windows");
    expect(descreverAparelho("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari no iPhone");
    expect(descreverAparelho("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36")).toBe("Chrome no Android");
    expect(descreverAparelho("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0")).toBe("Edge no Windows");
    expect(descreverAparelho("")).toBe("Navegador no aparelho desconhecido");
  });
});
