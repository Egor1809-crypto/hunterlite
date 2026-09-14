import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import QualityAssessment, { type QualityReport } from "./QualityAssessment";
it("shows earned points, explicit deductions and the exact trainee quote", () => {
  const report: QualityReport = {
    criteria:[{id:"introduction",layer:"communication",label:"Представиться",score:4,max_score:4,explanation:"Юрист представился.",evidence:{message_index:1,quote:"Меня зовут Иван, я юрист.",explanation:"Юрист представился."}}],
    deductions:[{category:"disrespect",label:"Грубость",penalty:-10,message_index:3,quote:"Мне всё равно, что вы думаете.",explanation:"Игнорирование позиции клиента."}],
    positive:4,penalty:-10,cap:100,total:0,summary:"Контакт сорван из-за грубости.",sources:[],
  };
  render(<QualityAssessment report={report}/>);
  expect(screen.getByRole("heading",{name:"За что начислены баллы"})).toBeInTheDocument();
  expect(screen.getByText("«Мне всё равно, что вы думаете.»")).toBeInTheDocument();
  expect(screen.getByText(/Начислено 4 · Штрафы −?[-]?10 · Итог 0/)).toBeInTheDocument();
  expect(screen.queryByText(/40 из 100/)).not.toBeInTheDocument();
});
