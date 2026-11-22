import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { urlDoSite } from "@/lib/caminhos";

/** Encerra a sessão (só por POST, para um link qualquer não deslogar ninguém). */
export async function POST(request: NextRequest) {
  if (supabaseConfigurado()) {
    const supabase = await criarClienteServidor();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(urlDoSite(request, "/"), { status: 303 });
}
