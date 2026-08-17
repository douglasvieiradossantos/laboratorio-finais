import assert from "node:assert/strict";
import test from "node:test";
import { teachingShapes } from "./annotations.ts";

/**
 * Os destaques automáticos, medidos nas posições da aula N0-R-MATE.
 */

const CUT = "paleRed";

function squaresOf(shapes: ReturnType<typeof teachingShapes>, brush: string): string[] {
  return shapes
    .filter((shape) => shape.brush === brush)
    .map((shape) => shape.orig as string)
    .sort();
}

test("depois de h1h4 a 4ª fileira inteira aparece como parede", () => {
  // n1 + h1h4: torre em h4, rei preto em e5, rei branco em e2.
  const shapes = teachingShapes("8/8/8/4k3/7R/8/4K3/8 b - - 1 1", ["h1", "h4"]);
  assert.deepEqual(squaresOf(shapes, CUT), ["a4", "b4", "c4", "d4", "e4", "f4", "g4"]);
});

test("torre em h1 com o rei branco em e2: nenhuma parede desenhada", () => {
  // A 1ª fileira não corta — o rei branco está do mesmo lado que o preto.
  const shapes = teachingShapes("8/8/8/4k3/8/8/4K3/7R w - - 0 1", null);
  assert.deepEqual(squaresOf(shapes, CUT), []);
});

test("h4c4 põe a torre ao alcance do rei preto: círculo vermelho", () => {
  // n2 + h4c4: a torre chega em c4, o rei preto em d5 a come, e o rei branco
  // em e2 está longe demais para defender.
  const shapes = teachingShapes("8/8/8/3k4/2R5/8/4K3/8 b - - 1 2", ["h4", "c4"]);
  assert.deepEqual(squaresOf(shapes, "red"), ["c4"]);
  assert.deepEqual(squaresOf(shapes, "green"), []);
});

test("a mesma torre atacada, mas defendida pelo rei: círculo verde", () => {
  // Rei branco em c3 segurando a torre em c4 — isto é a técnica, não um erro.
  const shapes = teachingShapes("8/8/8/2k5/2R5/2K5/8/8 b - - 1 1", ["c1", "c4"]);
  assert.deepEqual(squaresOf(shapes, "green"), ["c4"]);
  assert.deepEqual(squaresOf(shapes, "red"), []);
});

test("peça que ninguém ataca não ganha círculo nenhum", () => {
  const shapes = teachingShapes("8/8/8/4k3/7R/8/4K3/8 b - - 1 1", ["h1", "h4"]);
  assert.deepEqual(squaresOf(shapes, "red"), []);
  assert.deepEqual(squaresOf(shapes, "green"), []);
});
