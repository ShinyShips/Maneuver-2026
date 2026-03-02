import type { Handler } from '@netlify/functions';

type Provider = 'tba' | 'nexus' | 'statbotics';

const TBA_BASE_URL = 'https://www.thebluealliance.com/api/v3';
const NEXUS_BASE_URL = 'https://frc.nexus/api/v1';
const STATBOTICS_BASE_URL = 'https://api.statbotics.io/v3';

const tbaAllowed = [
  /^\/events\/\d+(?:\/simple)?$/,
  /^\/event\/[a-z0-9]+\/matches(?:\/simple)?$/i,
  /^\/event\/[a-z0-9]+\/coprs$/i,
  /^\/event\/[a-z0-9]+\/teams\/keys$/i,
  /^\/match\/[a-z0-9_]+$/i,
];

const nexusAllowed = [
  /^\/events$/,
  /^\/event\/[a-z0-9]+$/i,
  /^\/event\/[a-z0-9]+\/pits$/i,
  /^\/event\/[a-z0-9]+\/map$/i,
];

const statboticsAllowed = [
  /^\/team_event\/\d+\/[a-z0-9]+$/i,
];

function isAllowedEndpoint(provider: Provider, endpoint: string): boolean {
  const rules = provider === 'tba'
    ? tbaAllowed
    : provider === 'nexus'
      ? nexusAllowed
      : statboticsAllowed;
  return rules.some(rule => rule.test(endpoint));
}

function getServerApiKey(provider: Provider): string | undefined {
  if (provider === 'tba') {
    return process.env.TBA_API_KEY || process.env.TBA_AUTH_KEY || process.env.VITE_TBA_API_KEY;
  }
  if (provider === 'nexus') {
    return process.env.NEXUS_API_KEY || process.env.NEXUS_AUTH_KEY || process.env.VITE_NEXUS_API_KEY;
  }

  return process.env.STATBOTICS_API_KEY || process.env.VITE_STATBOTICS_API_KEY;
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Client-Api-Key',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=300',
    Vary: 'X-Client-Api-Key',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const provider = (event.queryStringParameters?.provider || '').toLowerCase() as Provider;
    const endpoint = event.queryStringParameters?.endpoint || '';

    if (provider !== 'tba' && provider !== 'nexus' && provider !== 'statbotics') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid provider' }) };
    }

    if (!endpoint.startsWith('/') || !isAllowedEndpoint(provider, endpoint)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Endpoint not allowed' }) };
    }

    const overrideKey = event.headers['x-client-api-key'] || event.headers['X-Client-Api-Key'];
    const apiKey = overrideKey || getServerApiKey(provider);

    const providerNeedsApiKey = provider !== 'statbotics';
    if (providerNeedsApiKey && !apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: `${provider.toUpperCase()} API key not configured on server. Set ${provider === 'tba' ? 'TBA_API_KEY (preferred) or TBA_AUTH_KEY (or VITE_TBA_API_KEY for local dev)' : provider === 'nexus' ? 'NEXUS_API_KEY (preferred) or NEXUS_AUTH_KEY (or VITE_NEXUS_API_KEY for local dev)' : 'STATBOTICS_API_KEY (optional for restricted deployments)'}`,
        }),
      };
    }

    const baseUrl = provider === 'tba'
      ? TBA_BASE_URL
      : provider === 'nexus'
        ? NEXUS_BASE_URL
        : STATBOTICS_BASE_URL;
    const upstreamHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...(provider === 'tba'
        ? { 'X-TBA-Auth-Key': apiKey }
        : provider === 'nexus'
          ? { 'Nexus-Api-Key': apiKey }
          : apiKey
            ? { Authorization: `Bearer ${apiKey}` }
            : {}),
    };

    const upstreamResponse = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: upstreamHeaders,
    });

    const text = await upstreamResponse.text();
    const upstreamCacheControl = upstreamResponse.headers.get('cache-control');

    return {
      statusCode: upstreamResponse.status,
      headers: {
        ...headers,
        ...(upstreamCacheControl ? { 'Cache-Control': upstreamCacheControl } : {}),
      },
      body: text || JSON.stringify({}),
    };
  } catch (error) {
    console.error('api-proxy error', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Proxy error' }),
    };
  }
};