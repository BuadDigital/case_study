const API_HOST = process.env.API_HOST ?? "127.0.0.1";

export const API_SERVICES = [
  { name: "gateway", url: `http://${API_HOST}:5160/health` },
  { name: "identity", url: `http://${API_HOST}:5161/ready` },
  { name: "case-study", url: `http://${API_HOST}:5162/ready` },
  { name: "operations", url: `http://${API_HOST}:5163/ready` },
  { name: "reporting", url: `http://${API_HOST}:5164/ready` },
  { name: "financial", url: `http://${API_HOST}:5165/ready` },
  { name: "valuation", url: `http://${API_HOST}:5166/ready` },
  { name: "failures", url: `http://${API_HOST}:5167/ready` },
  { name: "platform", url: `http://${API_HOST}:5168/ready` },
  { name: "attachments", url: `http://${API_HOST}:5169/ready` },
];

export const RABBITMQ_OVERVIEW = `http://${API_HOST}:15672/api/overview`;
export const RABBITMQ_AUTH_HEADER = `Basic ${Buffer.from("dev:dev").toString("base64")}`;
