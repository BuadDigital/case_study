import { test, expect } from "@playwright/test";
import {
  API_SERVICES,
  RABBITMQ_AUTH_HEADER,
  RABBITMQ_OVERVIEW,
} from "../../fixtures/api-services";
import { PASSWORD } from "../../fixtures/auth";

test.describe("API health", () => {
  for (const svc of API_SERVICES) {
    test(`${svc.name} responds`, async ({ request }) => {
      const res = await request.get(svc.url);
      expect(res.ok(), `expected ${svc.url} to be healthy`).toBeTruthy();
    });
  }

  test("gateway email/password login returns JWT", async ({ request }) => {
    const res = await request.post("http://127.0.0.1:5160/api/auth/login", {
      data: { username: "ahmed@ejadah.dev", password: PASSWORD },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.user?.displayName).toBeTruthy();
  });
});

test.describe("RabbitMQ", () => {
  test("management API is reachable", async ({ request }) => {
    const res = await request.get(RABBITMQ_OVERVIEW, {
      headers: { Authorization: RABBITMQ_AUTH_HEADER },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.rabbitmq_version).toBeTruthy();
  });
});
