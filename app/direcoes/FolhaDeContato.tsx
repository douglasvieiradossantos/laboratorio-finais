import type { Aferido } from "./Comparador";
import type { Direcao } from "./direcoes";

/**
 * A folha de contato — TEMPORÁRIA, sai no B6.5.
 *
 * Tudo o que a aula acima não mostra sozinha: a paleta inteira com o
 * hexadecimal ao lado, os pares de contraste mais apertados **com o número que
 * o CI mediu**, e um espécime tipográfico com título, corpo longo, rótulo em
 * caixa-alta e numeral tabular nas duas famílias.
 *
 * As amostras são pintadas pelas classes de verdade (`bg-papel` e companhia),
 * não por `style` inline: o que você vê é o que o site produz, e o hexadecimal
 * ao lado vem da mesma leitura de `globals.css` que reprova o teste.
 */

const grupos = (aferido: Aferido): [string, Aferido["amostras"]][] => {
  const mapa = new Map<string, Aferido["amostras"]>();
  for (const a of aferido.amostras) mapa.set(a.grupo, [...(mapa.get(a.grupo) ?? []), a]);
  return [...mapa];
};

export function FolhaDeContato({ direcao, aferido }: { direcao: Direcao; aferido: Aferido }) {
  return (
    <section className="flex flex-col gap-8 border-t border-borda pt-8">
      <header className="flex flex-col gap-2">
        <p className="rotulo text-tinta-apagada">Folha de contato</p>
        <h2 className="text-2xl font-bold tracking-tight">{direcao.rotulo}</h2>
      </header>

      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-lg border border-borda bg-carta px-4 py-4">
          <p className="rotulo text-tinta-apagada">Nome proposto</p>
          <p className="text-lg font-semibold">{direcao.nome}</p>
          <p className="text-sm leading-relaxed text-tinta-tenue">
            O nome é separável da direção — dá para levar o de A com a paleta de C.
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-borda bg-carta px-4 py-4">
          <p className="rotulo text-tinta-apagada">Tipografia</p>
          <p className="text-lg font-semibold">
            {direcao.serifa} <span className="text-tinta-tenue">+ Inter</span>
          </p>
          <p className="text-sm leading-relaxed text-tinta-tenue">{direcao.papeis}</p>
          <p className="text-sm leading-relaxed text-tinta-apagada">Custo: {direcao.custo}.</p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3">
        <h3 className="rotulo text-tinta-apagada">A paleta</h3>
        <div className="flex flex-col gap-4">
          {grupos(aferido).map(([grupo, amostras]) => (
            <div key={grupo} className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-tinta-fraca">{grupo}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {amostras.map((a) => (
                  <div
                    key={a.token}
                    className="flex items-center gap-3 rounded-md border border-borda-fraca bg-carta px-2 py-2"
                  >
                    <span
                      aria-hidden
                      className={`size-9 shrink-0 rounded border border-borda ${a.classe}`}
                    />
                    <span className="flex min-w-0 flex-col">
                      <code className="truncate text-xs text-tinta-fraca">{a.token}</code>
                      <code className="text-xs tabular-nums text-tinta-apagada">{a.hex}</code>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3">
        <h3 className="rotulo text-tinta-apagada">Contraste — os seis de menor folga</h3>
        <p className="max-w-prose text-sm leading-relaxed text-tinta-tenue">
          As {aferido.pares} combinações desta direção foram medidas na build, pela mesma régua que
          reprova o CI. Nenhuma está abaixo do piso — a menor de todas é{" "}
          <strong className="font-semibold tabular-nums text-tinta">
            {aferido.minimo.toFixed(2)}:1
          </strong>
          . Abaixo estão as seis que passam mais raspando.
        </p>
        <ul className="flex flex-col divide-y divide-borda-fraca rounded-lg border border-borda bg-carta px-4">
          {aferido.apertados.map((p) => (
            <li key={p.onde} className="flex items-baseline gap-3 py-2 text-sm">
              <span className="w-20 shrink-0 font-semibold tabular-nums text-metodo">
                {p.razao.toFixed(2)}:1
              </span>
              <span className="w-16 shrink-0 tabular-nums text-tinta-apagada">
                piso {p.piso.toFixed(1)}
              </span>
              <span className="min-w-0 leading-relaxed text-tinta-fraca">{p.onde}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3">
        <h3 className="rotulo text-tinta-apagada">Espécime</h3>
        <div className="flex flex-col gap-5 rounded-lg border border-borda bg-carta px-4 py-5">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Mate de torre e rei, sem a dama
          </h2>

          <p className="max-w-prose text-sm leading-relaxed text-tinta-media">
            O rei sozinho não dá mate. Quem dá é a torre, e o rei serve para tirar do adversário as
            casas que a torre não alcança. O método tem três movimentos que se repetem até a borda:
            cortar, aproximar, esperar. Enquanto o corte estiver de pé, o rei inimigo não atravessa
            a linha — e cada vez que ele tenta, a faixa em que ele vive fica um pouco menor.
          </p>

          <p className="max-w-prose text-sm leading-relaxed text-tinta-tenue">
            Este parágrafo está no mesmo corpo de 14 px que a aula usa hoje. Se a serifa pedir 16,
            é aqui que se decide — e subir de tamanho mexe num layout que você já validou jogando.
          </p>

          <p className="rotulo text-tinta-apagada">Rótulo em caixa-alta · o que a etapa cobra</p>

          {/* O numeral é o que mais denuncia fonte errada: se as figuras não
              forem tabulares, a coluna da direita dança a cada lance. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1 rounded-md border border-borda-fraca px-3 py-2">
              <p className="rotulo text-tinta-apagada">Numeral tabular · Inter</p>
              <p className="font-sans text-sm tabular-nums text-tinta-media">
                lance 7 · 1 038 nós · 0,42 s
                <br />
                lance 11 · 9 471 nós · 1,08 s
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-md border border-borda-fraca px-3 py-2">
              <p className="rotulo text-tinta-apagada">Numeral tabular · {direcao.serifa}</p>
              {/* Sem `.tabular-nums` na classe: aqui a serifa fala por si, e é
                  o que decide se ela poderia carregar o contador. */}
              <p className="text-sm text-tinta-media" style={{ fontVariantNumeric: "tabular-nums" }}>
                lance 7 · 1 038 nós · 0,42 s
                <br />
                lance 11 · 9 471 nós · 1,08 s
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded border border-metodo-superficie/40 bg-metodo-superficie/10 px-3 py-2 text-sm text-metodo-tinta">
              método
            </span>
            <span className="rounded border border-aviso-superficie/40 bg-aviso-superficie/10 px-3 py-2 text-sm text-aviso-tinta">
              aviso
            </span>
            <span className="rounded border border-erro-superficie/40 bg-erro-superficie/10 px-3 py-2 text-sm text-erro-tinta">
              erro
            </span>
            <span className="rounded border border-dica-superficie/30 bg-dica-superficie/5 px-3 py-2 text-sm text-dica-tinta">
              dica
            </span>
          </div>
        </div>
      </div>

      <p className="max-w-prose text-sm leading-relaxed text-tinta-apagada">
        O tabuleiro ainda está com o tema marrom que veio do pacote: casas, coordenadas e os quatro
        pincéis pedagógicos são o B6.4, e correm em paralelo a esta escolha. O que se julga aqui é a
        página em volta dele.
      </p>
    </section>
  );
}
