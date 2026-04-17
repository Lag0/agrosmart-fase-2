import type { ActionErrorCode } from "./errors";

export const ERROR_COPY_PT: Record<ActionErrorCode, string> = {
  API_UNAVAILABLE: "Serviço de análise indisponível. Tente em alguns instantes.",
  IMAGE_TOO_LARGE: "A imagem é grande demais. Use até 8 MB.",
  INVALID_MIME: "Formato não suportado. Use JPG, PNG, WEBP ou BMP.",
  DECODE_FAILED: "Não foi possível decodificar a imagem.",
  NO_LEAF_DETECTED: "Não identificamos folha na imagem. Envie uma foto mais próxima.",
  DUPLICATE: "Esta imagem já foi analisada anteriormente.",
  RATE_LIMITED: "Muitas tentativas. Aguarde alguns minutos.",
  DISK_FULL: "Espaço insuficiente no servidor.",
  TIMEOUT: "A análise demorou demais. Tente novamente com uma imagem menor.",
  INTERNAL: "Algo deu errado. Tente novamente.",
};
