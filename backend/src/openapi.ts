/** OpenAPI 3.0 description of /api/v1 (served at /openapi.json, rendered at /docs). */
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const nullable = (schema: object) => ({ ...schema, nullable: true });

const envelope = (data: object, extra: Record<string, object> = {}) => ({
  type: 'object',
  required: ['success', 'source', 'last_updated', 'data'],
  properties: {
    success: { type: 'boolean', example: true },
    source: { type: 'string', example: 'fixtures-onsat' },
    last_updated: nullable({ type: 'string', format: 'date-time' }),
    ...extra,
    data,
  },
});

const listResponse = (item: string, extra: Record<string, object> = {}) => ({
  description: 'OK',
  content: { 'application/json': { schema: envelope({ type: 'array', items: ref(item) }, { pagination: ref('Pagination'), ...extra }) } },
});
const oneResponse = (item: string) => ({ description: 'OK', content: { 'application/json': { schema: envelope(ref(item)) } } });
const errors = {
  400: { description: 'Invalid parameter', content: { 'application/json': { schema: ref('Error') } } },
  401: { description: 'API key required (only when API_KEYS is configured)', content: { 'application/json': { schema: ref('Error') } } },
  429: { description: 'Rate limited', content: { 'application/json': { schema: ref('Error') } } },
  503: { description: 'Data not yet synchronised', content: { 'application/json': { schema: ref('Error') } } },
};
const notFound = { 404: { description: 'Not found', content: { 'application/json': { schema: ref('Error') } } } };

const p = (name: string, description: string, schema: object = { type: 'string' }, inn = 'query') => ({ name, in: inn, required: inn === 'path', description, schema });
const matchFilters = [
  p('tz', 'IANA timezone used for date grouping/filtering (default UTC)', { type: 'string', example: 'Africa/Cairo' }),
  p('date', 'Only matches on this local date (YYYY-MM-DD)', { type: 'string', format: 'date' }),
  p('from', 'Local date lower bound (inclusive)', { type: 'string', format: 'date' }),
  p('to', 'Local date upper bound (inclusive)', { type: 'string', format: 'date' }),
  p('status', 'Comma-separated statuses', { type: 'string', example: 'live,halftime' }),
  p('competition', 'Competition id', { type: 'string', example: 'england-premier-league' }),
  p('team', 'Team id', { type: 'string' }),
  p('q', 'Search team / competition names (Arabic or English)'),
  p('has_channels', "'true' = only matches that have a channel list", { type: 'string', enum: ['true'] }),
  p('order', 'Sort by kickoff', { type: 'string', enum: ['asc', 'desc'] }),
  p('page', 'Page number (1-based)', { type: 'integer', minimum: 1 }),
  p('limit', 'Page size (max 500)', { type: 'integer', minimum: 1, maximum: 500 }),
];
const pageParams = matchFilters.slice(-2);

export function openApiSpec(serverUrl: string) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Fixtures ONSAT API',
      version: '1.0.0',
      description:
        'Normalized football fixtures, live status/scores and satellite broadcast channels.\n\n' +
        'Data source: the public pages behind the Fixtures ONSAT app (fixturessat.blogspot.com); live scores: ESPN public scoreboard (best effort). ' +
        'Responses share the envelope `{success, source, last_updated, data}`; errors are `{success:false, error:{status, code, message}}`.',
    },
    servers: [{ url: serverUrl || '/' }],
    tags: [{ name: 'Matches' }, { name: 'Competitions' }, { name: 'Teams' }, { name: 'Channels' }, { name: 'System' }],
    paths: {
      '/api/v1/matches': { get: { tags: ['Matches'], summary: 'All known matches (schedule + full-season fixtures)', parameters: matchFilters, responses: { 200: listResponse('Match', { timezone: { type: 'string' } }), ...errors } } },
      '/api/v1/matches/today': { get: { tags: ['Matches'], summary: "Today's matches in the given timezone", parameters: matchFilters, responses: { 200: listResponse('Match', { timezone: { type: 'string' }, date: { type: 'string', format: 'date' } }), ...errors } } },
      '/api/v1/matches/live': { get: { tags: ['Matches'], summary: 'Matches currently live or at half-time', parameters: matchFilters, responses: { 200: listResponse('Match'), ...errors } } },
      '/api/v1/matches/upcoming': { get: { tags: ['Matches'], summary: 'Matches not yet started, soonest first', parameters: matchFilters, responses: { 200: listResponse('Match'), ...errors } } },
      '/api/v1/matches/date/{date}': { get: { tags: ['Matches'], summary: 'Matches on a local date', parameters: [p('date', 'YYYY-MM-DD', { type: 'string', format: 'date' }, 'path'), ...matchFilters.filter((x) => x.name !== 'date')], responses: { 200: listResponse('Match'), ...errors } } },
      '/api/v1/matches/{id}': { get: { tags: ['Matches'], summary: 'Match details incl. broadcast channels', parameters: [p('id', 'Match id', { type: 'string' }, 'path')], responses: { 200: oneResponse('MatchDetails'), ...notFound, ...errors } } },
      '/api/v1/matches/{id}/channels': { get: { tags: ['Channels'], summary: 'Channels broadcasting a match', parameters: [p('id', 'Match id', { type: 'string' }, 'path')], responses: { 200: listResponse('Channel'), ...notFound, ...errors } } },
      '/api/v1/competitions': { get: { tags: ['Competitions'], summary: 'Competitions', parameters: [p('q', 'Search'), p('category', 'Category label'), ...pageParams], responses: { 200: listResponse('Competition'), ...errors } } },
      '/api/v1/competitions/{id}': { get: { tags: ['Competitions'], summary: 'One competition', parameters: [p('id', 'Competition id', { type: 'string' }, 'path')], responses: { 200: oneResponse('Competition'), ...notFound } } },
      '/api/v1/competitions/{id}/matches': { get: { tags: ['Competitions'], summary: 'Fixtures of a competition', parameters: [p('id', 'Competition id', { type: 'string' }, 'path'), ...matchFilters], responses: { 200: listResponse('Match'), ...notFound, ...errors } } },
      '/api/v1/teams': { get: { tags: ['Teams'], summary: 'Teams (derived from fixtures)', parameters: [p('q', 'Search'), p('competition', 'Competition id'), ...pageParams], responses: { 200: listResponse('Team'), ...errors } } },
      '/api/v1/teams/{id}': { get: { tags: ['Teams'], summary: 'One team', parameters: [p('id', 'Team id', { type: 'string' }, 'path')], responses: { 200: oneResponse('Team'), ...notFound } } },
      '/api/v1/teams/{id}/matches': { get: { tags: ['Teams'], summary: "A team's matches", parameters: [p('id', 'Team id', { type: 'string' }, 'path'), ...matchFilters], responses: { 200: listResponse('Match'), ...notFound, ...errors } } },
      '/api/v1/channels': { get: { tags: ['Channels'], summary: 'All channels/transponders from the satellite lists', parameters: [p('q', 'Search name'), p('satellite', 'Satellite name, e.g. Nilesat'), p('encrypted', 'true/false', { type: 'string', enum: ['true', 'false'] }), ...pageParams], responses: { 200: listResponse('Channel'), ...errors } } },
      '/api/v1/satellites': { get: { tags: ['Channels'], summary: 'Satellites', responses: { 200: { description: 'OK', content: { 'application/json': { schema: envelope({ type: 'array', items: ref('Satellite') }) } } } } } },
      '/api/v1/satellites/{id}/channels': { get: { tags: ['Channels'], summary: 'Channels on a satellite', parameters: [p('id', 'Satellite id', { type: 'string' }, 'path'), p('q', 'Search')], responses: { 200: { description: 'OK', content: { 'application/json': { schema: envelope({ type: 'array', items: ref('Channel') }) } } }, ...notFound } } },
      '/api/v1/feeds': { get: { tags: ['Channels'], summary: 'Temporary feed transponders', responses: { 200: { description: 'OK', content: { 'application/json': { schema: envelope({ type: 'array', items: ref('Feed') }) } } } } } },
      '/api/v1/status': { get: { tags: ['System'], summary: 'Sync status, counts and recent source issues', responses: { 200: { description: 'OK' } } } },
      '/health': { get: { tags: ['System'], summary: 'Health check (no auth, no rate limit)', responses: { 200: { description: 'OK' } } } },
    },
    components: {
      securitySchemes: { ApiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'Only required when the server sets API_KEYS' } },
      schemas: {
        Pagination: { type: 'object', properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, total_pages: { type: 'integer' } } },
        Error: { type: 'object', properties: { success: { type: 'boolean', example: false }, error: { type: 'object', properties: { status: { type: 'integer' }, code: { type: 'string' }, message: { type: 'string' } } } } },
        TeamRef: { type: 'object', properties: { id: { type: 'string', example: 't_UXcqj7HG' }, name: { type: 'string', example: 'مان سيتي' }, name_en: nullable({ type: 'string', example: 'Manchester City' }), logo: nullable({ type: 'string', format: 'uri' }) } },
        CompetitionRef: { type: 'object', properties: { id: { type: 'string', example: 'england-premier-league' }, name: { type: 'string' }, logo: nullable({ type: 'string' }) } },
        Match: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'm_3f1c2a9b8d7e' },
            kickoff: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['upcoming', 'live', 'halftime', 'finished', 'postponed', 'cancelled'] },
            status_source: { type: 'string', enum: ['live-feed', 'estimated'] },
            minute: nullable({ type: 'string', example: "67'" }),
            home_team: ref('TeamRef'),
            away_team: ref('TeamRef'),
            competition: nullable(ref('CompetitionRef')),
            round: nullable({ type: 'string' }),
            score: { type: 'object', properties: { home: nullable({ type: 'integer' }), away: nullable({ type: 'integer' }) } },
            main_channel_logo: nullable({ type: 'string' }),
            has_details: { type: 'boolean' },
            source_url: nullable({ type: 'string', format: 'uri' }),
          },
        },
        MatchDetails: {
          allOf: [
            ref('Match'),
            {
              type: 'object',
              properties: {
                watch_on: nullable({ type: 'object', properties: { name: { type: 'string' }, logo: nullable({ type: 'string' }) } }),
                commentator: nullable({ type: 'string' }),
                channels: { type: 'array', items: ref('Channel') },
              },
            },
          ],
        },
        Channel: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', example: 'beIN SPORTS 1' },
            logo: nullable({ type: 'string' }),
            satellite: nullable({ type: 'string', example: 'Nilesat 7°W' }),
            frequency: nullable({ type: 'integer', example: 12418 }),
            polarization: nullable({ type: 'string', enum: ['H', 'V', 'L', 'R'] }),
            symbol_rate: nullable({ type: 'integer', example: 30000 }),
            tuning: nullable({ type: 'string', example: 'Nilesat 7°W - 12418 H 30000' }),
            quality: nullable({ type: 'string', example: 'HD' }),
            encrypted: nullable({ type: 'boolean' }),
            sharing_supported: { type: 'boolean' },
          },
        },
        Competition: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, logo: nullable({ type: 'string' }), category: nullable({ type: 'string' }), season: nullable({ type: 'string' }), match_count: { type: 'integer' } } },
        Team: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, logo: nullable({ type: 'string' }), competitions: { type: 'array', items: { type: 'string' } }, match_count: { type: 'integer' } } },
        Satellite: { type: 'object', properties: { id: { type: 'string', example: 'nilesat' }, name: { type: 'string', example: 'Nilesat 7°W' }, region: nullable({ type: 'string' }), channel_count: { type: 'integer' } } },
        Feed: { type: 'object', properties: { id: { type: 'string' }, tuning: { type: 'string' }, satellite: nullable({ type: 'string' }), frequency: nullable({ type: 'integer' }), polarization: nullable({ type: 'string' }), symbol_rate: nullable({ type: 'integer' }), encryption: nullable({ type: 'string' }), home_team: nullable({ type: 'object' }), away_team: nullable({ type: 'object' }) } },
      },
    },
    security: [{}, { ApiKey: [] }],
  };
}
