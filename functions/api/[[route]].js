// ARTBITRAGE API — catalogue and data distributor of the art world
// Serverless API running on Cloudflare Pages Functions.
//
// This is the only file route. Every /api request is matched against the
// declared table in functions/_domains/ (one route, one place); shared
// response, parameter, rights and upstream code lives in functions/_kernel/.
// docs/api-architecture.md explains the shape.
import { handle } from '../_domains/index.js';

export const onRequestGet = context => handle(context, 'GET');
export const onRequestPost = context => handle(context, 'POST');
export const onRequestOptions = context => handle(context, 'OPTIONS');
