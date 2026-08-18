import type { Metadata } from "next";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { loadLesson } from "@/lib/lesson/content";
import { contraste, hex, sobrepor, type Cor, type Vars } from "@/lib/tema/cor";
import { corDeToken, lerFolha, temasPorSeletor } from "@/lib/tema/css";
import { PARES } from "@/lib/tema/pares";
import { Comparador, type Aferido } from "./Comparador";
import { DIRECOES } from "./direcoes";

/**
 * `/direcoes` — a tela onde a identidade é escolhida. TEMPORÁRIA, sai no B6.5.
 *
 * **Por que uma rota e não uma imagem.** Você abre no seu navegador, no celular
 * e no desktop, e julga no dispositivo em que a aula vai ser dada. Nenhuma
 * captura de tela entra no contexto de ninguém, e a coordenada do tabuleiro é
 * lida no tamanho real em vez de num recorte.
 *
 * **Uma instância só, com interruptor**, e não as três lado a lado: o estado da
 * aula é um singleton de módulo (`lib/lesson/store.ts`), então três
 * `LessonPlayer` moveriam juntos. E no celular três tabuleiros de 88vw viram
 * 29vw cada — não se julga tipografia nem contraste de coordenada nesse
 * tamanho. Alternar na mesma posição da tela é também a comparação que o olho
 * faz melhor.
 *
 * **Os números da folha de contato são medidos aqui, no servidor**, pela mesma
 * `lib/tema/` que reprova o CI — lendo `app/globals.css` do disco na build. Não
 * são estimativa nem cópia: se um par mudar, a página muda junto, e se algum
 * reprovar, o `npm test` fica vermelho antes de a página existir.
 */

export const metadata: Metadata = {
  title: "Direções — escolha da identidade",
  robots: { index: false, follow: false },
};

/** A aula usada como cobaia. É a única publicada, e exercita as seis etapas. */
const AULA = "N0-R-MATE";

/** Quantos pares apertados a folha mostra por direção. */
const APERTADOS = 6;

function aferir(chave: string, vars: Vars): Aferido {
  const cor = (nome: string): Cor => corDeToken(nome, vars);

  const medidos = PARES.filter((par) => par.isencao === undefined).map((par) => {
    const pilhaFundo = par.fundo.map(cor);
    const pilhaTexto = (Array.isArray(par.texto) ? par.texto : [par.texto]).map(cor);
    return {
      onde: par.onde,
      piso: par.piso,
      razao: contraste(sobrepor([...pilhaTexto, ...pilhaFundo]), sobrepor(pilhaFundo)),
    };
  });

  const porFolga = [...medidos].sort((a, b) => a.razao - a.piso - (b.razao - b.piso));

  return {
    chave,
    pares: medidos.length,
    minimo: Math.min(...medidos.map((m) => m.razao)),
    apertados: porFolga.slice(0, APERTADOS),
    amostras: AMOSTRAS.map((a) => ({ ...a, hex: hex(cor(a.token)) })),
  };
}

/**
 * As amostras da folha. A classe vai escrita por extenso porque o Tailwind lê
 * o código-fonte procurando string literal: `bg-${token}` não geraria nada.
 */
const AMOSTRAS = [
  { grupo: "Superfícies", token: "papel", classe: "bg-papel" },
  { grupo: "Superfícies", token: "carta", classe: "bg-carta" },
  { grupo: "Superfícies", token: "carta-alta", classe: "bg-carta-alta" },
  { grupo: "Superfícies", token: "carta-toque", classe: "bg-carta-toque" },
  { grupo: "Tinta", token: "tinta", classe: "bg-tinta" },
  { grupo: "Tinta", token: "tinta-media", classe: "bg-tinta-media" },
  { grupo: "Tinta", token: "tinta-fraca", classe: "bg-tinta-fraca" },
  { grupo: "Tinta", token: "tinta-tenue", classe: "bg-tinta-tenue" },
  { grupo: "Tinta", token: "tinta-apagada", classe: "bg-tinta-apagada" },
  { grupo: "Tinta", token: "tinta-muda", classe: "bg-tinta-muda" },
  { grupo: "Método", token: "metodo", classe: "bg-metodo" },
  { grupo: "Método", token: "metodo-cheio", classe: "bg-metodo-cheio" },
  { grupo: "Método", token: "metodo-superficie", classe: "bg-metodo-superficie" },
  { grupo: "Método", token: "metodo-tinta", classe: "bg-metodo-tinta" },
  { grupo: "Aviso", token: "aviso", classe: "bg-aviso" },
  { grupo: "Aviso", token: "aviso-superficie", classe: "bg-aviso-superficie" },
  { grupo: "Aviso", token: "aviso-tinta", classe: "bg-aviso-tinta" },
  { grupo: "Erro", token: "erro", classe: "bg-erro" },
  { grupo: "Erro", token: "erro-superficie", classe: "bg-erro-superficie" },
  { grupo: "Erro", token: "erro-texto", classe: "bg-erro-texto" },
  { grupo: "Dica", token: "dica-superficie", classe: "bg-dica-superficie" },
  { grupo: "Dica", token: "dica-tinta", classe: "bg-dica-tinta" },
];

export default function DirecoesPage() {
  const bundle = loadLesson(AULA);
  if (!bundle) notFound();

  // `process.cwd()` e não `import.meta.url`: o empacotador move este módulo, e
  // o caminho relativo a ele deixa de apontar para a folha. A build roda na
  // raiz do projeto.
  const temas = temasPorSeletor(lerFolha(join(process.cwd(), "app/globals.css")));
  const aferidos = Object.fromEntries(
    DIRECOES.map((d) => [d.chave, aferir(d.chave, temas[d.chave])]),
  );

  return <Comparador bundle={bundle} aferidos={aferidos} />;
}
