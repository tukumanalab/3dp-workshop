import QRCode from "qrcode";

/** 自前で生成した QR の SVG 文字列（入力は URL のみ）。 */
export const qrSvg = (text: string) => QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
