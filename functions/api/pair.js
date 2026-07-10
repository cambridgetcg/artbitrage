// ARTBITRAGE /api/pair — directory of the pairing vertical
// Serverless API running on Cloudflare Pages Functions.
// This file handles GET /api/pair exactly; all subroutes live in functions/api/pair/[[route]].js

const VERTICAL = 'pair';
const TITLE = 'Pairing — The Marriage of Smoke and Wine';
const ESSENCE = 'A pairing is arbitrage between two finished arts: each supplies what the other lacks, and the marriage trades above its parts.';

const ENDPOINTS = [
  { method: 'GET', path: '/api/pair', desc: 'This directory' },
  { method: 'GET', path: '/api/pair/principles', desc: 'The laws of pairing: why smoke and wine marry' },
  { method: 'GET', path: '/api/pair/marriages', desc: 'All wine-and-cigar marriages' },
  { method: 'GET', path: '/api/pair/marriages/:id', desc: 'One marriage by id, its wine and cigar refs resolved to full brand objects' },
  { method: 'GET', path: '/api/pair/cautions', desc: 'Pairings that fight, and why' },
  { method: 'GET', path: '/api/pair/ritual', desc: 'How to conduct the pairing, step by step' },
  { method: 'GET', path: '/api/pair/random', desc: 'A random marriage, refs resolved to full brand objects' },
  { method: 'GET', path: '/api/pair/for?wine=&cigar=', desc: 'Marriages matching a wine and/or cigar by id or keyword, resolved' },
  { method: 'GET', path: '/api/pair/search?q=', desc: 'Case-insensitive search across principles, marriages and cautions' },
];

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequestGet() {
  return jsonResponse({ vertical: VERTICAL, title: TITLE, essence: ESSENCE, endpoints: ENDPOINTS });
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
