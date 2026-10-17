import { describe, expect, it } from "vitest";
import { recordTokens } from "./Registros";
import { pastedLines } from "./plainPaste";

const marked = (text: string) =>
  recordTokens(text).map((t) => (t.sep ? "·" : "") + text.slice(t.from, t.to));

describe("recordTokens", () => {
  it("número, nome e CPF: destaca os dois números e põe · antes do CPF", () => {
    expect(marked("11900000001 Ana Paula Ribeiro 11122233344")).toEqual(["11900000001", "·11122233344"]);
    expect(marked("(11) 90000-1234 Ana Paula Ribeiro 111.222.333-44")).toEqual(["(11) 90000-1234", "·111.222.333-44"]);
  });

  it("não repete o separador que a pessoa já digitou", () => {
    expect(marked("11900000001 Ana Ribeiro · 11122233344")).toEqual(["11900000001", "11122233344"]);
    expect(marked("11900000001 - Ana Ribeiro - 11122233344")).toEqual(["11900000001", "11122233344"]);
  });

  it("sem nome entre os números, sem ·", () => {
    expect(marked("11900000001 11122233344")).toEqual(["11900000001", "11122233344"]);
    expect(marked("11900000001")).toEqual(["11900000001"]);
  });

  it("um número só depois do nome também ganha ·", () => {
    expect(marked("Ana Ribeiro 11122233344")).toEqual(["·11122233344"]);
  });

  it("ignora números curtos e pedaços de palavra", () => {
    expect(marked("AB1 - código 2024 e 12345")).toEqual([]);
    expect(marked("ID AB12345678901 fim")).toEqual([]);
  });
});

describe("pastedLines", () => {
  it("uma linha por registro, sem as vazias e sem espaço no fim", () => {
    expect(pastedLines("um  \r\n\r\ndois\n   \ntrês")).toEqual(["um", "dois", "três"]);
  });
});
