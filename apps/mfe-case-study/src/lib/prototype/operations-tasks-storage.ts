import type {

  CreateOperationsTaskRequest,

  OperationsTaskDto,

  PatchOperationsTaskRequest,

  ReassignOperationsTaskRequest,

} from "@platform/api-client";

import {

  addOperationsTaskComment,

  createOperationsTask,

  listOperationsTasks,

  patchOperationsTask,

  reassignOperationsTask,

  remindOperationsTask,

} from "@platform/api-client";

import {

  resolveApiError,

  workOrdersApiConfig,

} from "../work-orders-api-config";



export type OperationsTask = OperationsTaskDto;



export const OPERATIONS_TASKS_CHANGED_EVENT = "eval-operations-tasks-changed";



export function notifyOperationsTasksChanged(): void {

  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(OPERATIONS_TASKS_CHANGED_EVENT));

}



export async function loadOperationsTasks(query?: {

  assigneeId?: string;

  createdBy?: string;

  status?: string;

}): Promise<OperationsTask[]> {

  const config = workOrdersApiConfig();

  if (!config) return [];

  const result = await listOperationsTasks(config, query);

  if (!result.ok) {

    throw new Error(

      result.message ?? resolveApiError(result.kind, undefined, "تعذّر تحميل المهام"),

    );

  }

  return result.data;

}



export async function createOperationsTaskRecord(

  body: CreateOperationsTaskRequest,

): Promise<{ ok: true; task: OperationsTask } | { ok: false; error: string }> {

  const config = workOrdersApiConfig();

  if (!config) return { ok: false, error: "تسجيل الدخول مطلوب" };

  const result = await createOperationsTask(config, body);

  if (!result.ok) {

    return {

      ok: false,

      error: result.message ?? resolveApiError(result.kind, undefined, "تعذّر إنشاء المهمة"),

    };

  }

  notifyOperationsTasksChanged();

  return { ok: true, task: result.data };

}



export async function patchOperationsTaskRecord(

  id: string,

  body: PatchOperationsTaskRequest,

): Promise<{ ok: true; task: OperationsTask } | { ok: false; error: string }> {

  const config = workOrdersApiConfig();

  if (!config) return { ok: false, error: "تسجيل الدخول مطلوب" };

  const result = await patchOperationsTask(config, id, body);

  if (!result.ok) {

    return {

      ok: false,

      error: result.message ?? resolveApiError(result.kind, undefined, "تعذّر تحديث المهمة"),

    };

  }

  notifyOperationsTasksChanged();

  return { ok: true, task: result.data };

}



export async function reassignOperationsTaskRecord(

  id: string,

  body: ReassignOperationsTaskRequest,

): Promise<{ ok: true; task: OperationsTask } | { ok: false; error: string }> {

  const config = workOrdersApiConfig();

  if (!config) return { ok: false, error: "تسجيل الدخول مطلوب" };

  const result = await reassignOperationsTask(config, id, body);

  if (!result.ok) {

    return {

      ok: false,

      error:

        result.message ?? resolveApiError(result.kind, undefined, "تعذّر إعادة التوجيه"),

    };

  }

  notifyOperationsTasksChanged();

  return { ok: true, task: result.data };

}



export async function remindOperationsTaskRecord(

  id: string,

): Promise<{ ok: true; task: OperationsTask } | { ok: false; error: string }> {

  const config = workOrdersApiConfig();

  if (!config) return { ok: false, error: "تسجيل الدخول مطلوب" };

  const result = await remindOperationsTask(config, id);

  if (!result.ok) {

    return {

      ok: false,

      error: result.message ?? resolveApiError(result.kind, undefined, "تعذّر إرسال التذكير"),

    };

  }

  notifyOperationsTasksChanged();

  return { ok: true, task: result.data };

}



export async function addOperationsTaskCommentRecord(

  id: string,

  text: string,

  kind?: string,

  files?: { name: string; size: string }[],

): Promise<{ ok: true; task: OperationsTask } | { ok: false; error: string }> {

  const config = workOrdersApiConfig();

  if (!config) return { ok: false, error: "تسجيل الدخول مطلوب" };

  const result = await addOperationsTaskComment(config, id, text, kind, files);

  if (!result.ok) {

    return {

      ok: false,

      error: result.message ?? resolveApiError(result.kind, undefined, "تعذّر إضافة التعليق"),

    };

  }

  notifyOperationsTasksChanged();

  return { ok: true, task: result.data };

}



export function isActiveOperationsTask(task: OperationsTask): boolean {

  return task.status === "created" || task.status === "in_progress";

}



export function isTerminalOperationsTask(task: OperationsTask): boolean {

  return task.status === "completed" || task.status === "cancelled";

}

