import { describe, expect, it } from "vitest";
import { combineReadings, normalizeLine, parseReceiptText, textToLines, type OcrLine } from "./parse";

describe("normalizeLine", () => {
  it("joins Chinese characters that OCR split apart", () => {
    expect(normalizeLine("支 付 时 间  2026 年 10 月 11 日")).toBe("支付时间 2026 年 10 月 11 日");
  });

  it("keeps spaces between Latin words", () => {
    expect(normalizeLine("Family  Mart 全 家")).toBe("Family Mart 全家");
  });
});

describe("parseReceiptText", () => {
  it("reads a WeChat Pay bill", () => {
    const text = `
14:23
< 账 单 详 情
全 家 便 利 店
-25.00
当 前 状 态    支 付 成 功
支 付 时 间    2026年10月11日 14:23:05
商 品    便利店消费
商 户 全 称    上海福满家便利有限公司
支 付 方 式    零钱
`;
    expect(parseReceiptText(text)).toEqual({ amountCents: 2500, merchant: "全家便利店", spentOn: "2026-10-11", paidAt: "14:23" });
  });

  it("reads an Alipay bill", () => {
    const text = `
麦 当 劳
-128.50
交 易 成 功
支 付 时 间 2026-09-03 12:01:44
付 款 方 式 余额宝
收 款 方 全 称 金拱门（中国）有限公司
`;
    expect(parseReceiptText(text)).toEqual({ amountCents: 12850, merchant: "麦当劳", spentOn: "2026-09-03", paidAt: "12:01" });
  });

  it("reads a WeChat payment success screen where OCR misreads the yuan sign", () => {
    const text = `
支 付 成 功
Y 36.00
收 款 方    手 工 烘 焙 坊
`;
    expect(parseReceiptText(text)).toEqual({ amountCents: 3600, merchant: "手工烘焙坊" });
  });

  it("reads a shopping order with a labelled total", () => {
    const text = `
订 单 详 情
店 铺 : 烘焙原料旗舰店
低筋面粉 2.5kg x2
商品总价 ¥ 96.00
运费 ¥ 0.00
实 付 款 ¥ 1,086.40
下 单 时 间 : 2026-10-02 20:14:09
`;
    expect(parseReceiptText(text)).toEqual({ amountCents: 108640, merchant: "烘焙原料旗舰店", spentOn: "2026-10-02", paidAt: "20:14" });
  });

  it("reads an English-language WeChat bill", () => {
    const text = `
Starbucks
-42.00
Status Payment Successful
Transaction Time Oct 3, 2026 2026-10-03 09:12:00
Merchant Name Starbucks Coffee (Shanghai) Co., Ltd.
`;
    expect(parseReceiptText(text)).toEqual({ amountCents: 4200, merchant: "Starbucks", spentOn: "2026-10-03", paidAt: "09:12" });
  });

  // Real OCR output from a club member's screenshots, so the parser is checked against what Tesseract actually produces.
  it("reads a real WeChat Pay bill", () => {
    const text = `19:38 ¢                             EY co

闪送

-31.20

当前状态 支付成功

支付时间     2026年9月24日 21:47:10

商品        闪送-DH2026092469712878

商户全称 北京同城必应科技有限公司

收单机构 。。 财付通支付科技有限公司

支付方式 零钱

交易单号       4500000429202609247505106987
商户单号       7508884723616418152

商家小程序                        LAE >
账单服务`;
    expect(parseReceiptText(text)).toEqual({
      amountCents: 3120,
      merchant: "闪送",
      spentOn: "2026-09-24",
      paidAt: "21:47",
      transactionId: "4500000429202609247505106987",
    });
  });

  it("reads a real Alipay balance detail", () => {
    const text = `19:38 7                             2 TE

<                        余额明细详情

日

OPENROUTER, INC

-142.13

关联账单         查看账单详情

支付时间            2026-10-10 10:53:06

付款方式         可用余额

交易类型         支出

商品说明         OPENROUTER, INC

对方账户          OpenRouter, Inc

交易号           202610102200146407143785339
8

余额                   Y3.81`;
    expect(parseReceiptText(text)).toEqual({
      amountCents: 14213,
      merchant: "OpenRouter, Inc",
      spentOn: "2026-10-10",
      paidAt: "10:53",
      transactionId: "2026101022001464071437853398",
    });
  });

  it("drops a transaction number with a digit missing", () => {
    expect(parseReceiptText("交易号 202610102200146407143785339").transactionId).toBeUndefined();
  });

  it("leaves fields empty rather than guessing", () => {
    expect(parseReceiptText("a photo of a cat")).toEqual({});
  });

  it("ignores impossible dates", () => {
    expect(parseReceiptText("支付时间 2026-02-30 10:00")).toEqual({});
  });
});

describe("combineReadings", () => {
  const headline = "闪送\n-31.20\n支付时间 2026年9月24日 21:47:10\n商户全称 北京同城必应科技有限公司";
  const detailOnly = "支付时间 2026年9月24日 21:47:10\n商户全称 北京同城必应科技有限公司";

  it("takes the amount and shop from the reading that found the headline", () => {
    expect(combineReadings([textToLines(headline), textToLines(detailOnly)])).toEqual({ amountCents: 3120, merchant: "闪送", spentOn: "2026-09-24", paidAt: "21:47" });
    expect(combineReadings([textToLines(detailOnly), textToLines(headline)])).toEqual({ amountCents: 3120, merchant: "闪送", spentOn: "2026-09-24", paidAt: "21:47" });
  });

  it("falls back to labelled fields when no reading found a headline", () => {
    expect(combineReadings([textToLines(detailOnly), textToLines(detailOnly)])).toEqual({ merchant: "北京同城必应科技有限公司", spentOn: "2026-09-24", paidAt: "21:47" });
  });

  it("leaves a field empty when readings disagree", () => {
    const misread = headline.replace("9月24日", "9月21日");
    expect(combineReadings([textToLines(headline), textToLines(misread)])).toEqual({ amountCents: 3120, merchant: "闪送" });
  });
});

// Real Tesseract output with its line confidences, from members' screenshots.
const lines = (rows: [number, string][]): OcrLine[] => rows.map(([confidence, text]) => ({ text, confidence }));

describe("confidence", () => {
  it("ignores a garbled shop name and falls back to the legal name (DiDi, WeChat)", () => {
    const small = lines([[54, "HAT"], [91, "-45.00"], [93, "支付时间     2026年8月14日 18:52:52"], [93, "商户全称       天津舒行科技有限公司"], [89, "交易单号       4500000323202608147377866981"]]);
    const large = lines([[71, "滴泣出行"], [90, "-45.00"], [92, "支付时间     2026年8月14日 18:52:52"], [91, "商户全称       天津舒行科技有限公司"], [93, "交易单号       4500000323202608147377866981"]]);
    expect(combineReadings([small, large])).toEqual({
      amountCents: 4500,
      merchant: "天津舒行科技有限公司",
      spentOn: "2026-08-14",
      paidAt: "18:52",
      transactionId: "4500000323202608147377866981",
    });
  });

  it("uses Alipay's counterparty row as the shop, not the product name above the amount (Tmall)", () => {
    const small = lines([[81, "钻技情侣礼物随行咖啡杯外出携带陶瓷内胆全自动电"], [78, "动搅拌杯水杯"], [88, "-128.00"], [93, "支付时间           2026-09-13 13:32:28"], [90, "对方账户      钻技**店"]]);
    const large = lines([[90, "钻技情侣礼物随行咖啡杯外出携带陶瓷内胆全自动电"], [90, "动搅拌杯水杯"], [92, "-128.00"], [91, "支付时间          2026-09-13 13:32:28"], [76, "对方账户      HIE"]]);
    expect(combineReadings([small, large])).toEqual({ amountCents: 12800, merchant: "钻技**店", spentOn: "2026-09-13", paidAt: "13:32" });
  });

  it("prefers the full company name over a two-letter brand (OK convenience store)", () => {
    const reading = lines([[88, "OK"], [90, "-14.13"], [92, "支付时间     2026年8月23日 09:04:32"], [91, "商户全称 OK便利店(澳门)有限公司"]]);
    expect(combineReadings([reading])).toMatchObject({ amountCents: 1413, merchant: "OK便利店(澳门)有限公司" });
  });

  it("lets a much more confident reading settle a disagreement", () => {
    const a = lines([[95, "-31.20"], [95, "支付时间 2026年9月24日 21:47:10"]]);
    const b = lines([[95, "-31.20"], [81, "支付时间 2026年9月21日 21:47:10"]]);
    expect(combineReadings([a, b]).spentOn).toBe("2026-09-24");
  });
});

