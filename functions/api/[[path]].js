// Cloudflare Pages Functions edge gateway
// This automatically routes all /api/* requests directly to the Cloudflare Worker & D1 binding
import worker from "../../cloudflare-api-worker.js";

export async function onRequest(context) {
  const { request, env } = context;
  return worker.fetch(request, env, context);
}

export async function onRequestPost(context) {
  return onRequest(context);
}

export async function onRequestGet(context) {
  return onRequest(context);
}

export async function onRequestOptions(context) {
  return onRequest(context);
}

export async function onRequestPut(context) {
  return onRequest(context);
}

export async function onRequestDelete(context) {
  return onRequest(context);
}
