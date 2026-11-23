import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS } from '../lib/tools.js';

test('TOOLS is a non-empty array', () => {
  assert.ok(Array.isArray(TOOLS));
  assert.ok(TOOLS.length > 0);
});

test('every tool has the required top-level shape', () => {
  for (const tool of TOOLS) {
    assert.equal(typeof tool.name, 'string', 'name must be a string');
    assert.ok(tool.name.length > 0, 'name must not be empty');
    assert.equal(typeof tool.description, 'string', `${tool.name}: description must be a string`);
    assert.ok(tool.description.length > 0, `${tool.name}: description must not be empty`);

    assert.ok(tool.inputSchema, `${tool.name}: missing inputSchema`);
    assert.equal(tool.inputSchema.type, 'object', `${tool.name}: inputSchema.type must be "object"`);
    assert.equal(typeof tool.inputSchema.properties, 'object', `${tool.name}: inputSchema.properties must be an object`);
    assert.notEqual(tool.inputSchema.properties, null, `${tool.name}: inputSchema.properties must not be null`);
  }
});

test('tool names are unique', () => {
  const seen = new Set();
  for (const tool of TOOLS) {
    assert.ok(!seen.has(tool.name), `duplicate tool name: ${tool.name}`);
    seen.add(tool.name);
  }
});

test('required fields are declared in properties', () => {
  for (const tool of TOOLS) {
    const required = tool.inputSchema.required ?? [];
    assert.ok(Array.isArray(required), `${tool.name}: required must be an array when present`);
    for (const key of required) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(tool.inputSchema.properties, key),
        `${tool.name}: required "${key}" missing from properties`
      );
    }
  }
});

test('annotations (when present) use boolean hints', () => {
  const allowed = new Set([
    'title',
    'readOnlyHint',
    'destructiveHint',
    'idempotentHint',
    'openWorldHint'
  ]);
  for (const tool of TOOLS) {
    if (!tool.annotations) continue;
    for (const [key, value] of Object.entries(tool.annotations)) {
      assert.ok(allowed.has(key), `${tool.name}: unexpected annotation key "${key}"`);
      if (key === 'title') {
        assert.equal(typeof value, 'string', `${tool.name}: annotations.title must be a string`);
      } else {
        assert.equal(typeof value, 'boolean', `${tool.name}: annotations.${key} must be a boolean`);
      }
    }
  }
});

test('expected tools are present', () => {
  const names = TOOLS.map((t) => t.name);
  const expected = [
    'slack_token_status',
    'slack_health_check',
    'slack_refresh_tokens',
    'slack_list_conversations',
    'slack_conversations_history',
    'slack_get_full_conversation',
    'slack_search_messages',
    'slack_users_info',
    'slack_send_message',
    'slack_get_thread',
    'slack_list_users'
  ];
  for (const name of expected) {
    assert.ok(names.includes(name), `missing tool: ${name}`);
  }
});

test('read-only tools declare readOnlyHint true', () => {
  const readOnlyNames = [
    'slack_token_status',
    'slack_health_check',
    'slack_list_conversations',
    'slack_conversations_history',
    'slack_search_messages',
    'slack_users_info',
    'slack_get_thread',
    'slack_list_users'
  ];
  for (const name of readOnlyNames) {
    const tool = TOOLS.find((t) => t.name === name);
    assert.ok(tool, `missing tool: ${name}`);
    assert.equal(tool.annotations?.readOnlyHint, true, `${name}: readOnlyHint should be true`);
  }
});

test('mutating tools declare readOnlyHint false', () => {
  for (const name of ['slack_refresh_tokens', 'slack_send_message', 'slack_get_full_conversation']) {
    const tool = TOOLS.find((t) => t.name === name);
    assert.ok(tool, `missing tool: ${name}`);
    assert.equal(tool.annotations?.readOnlyHint, false, `${name}: readOnlyHint should be false`);
  }
});

test('slack_get_full_conversation is not read-only because output_file writes an export', () => {
  const tool = TOOLS.find((t) => t.name === 'slack_get_full_conversation');
  assert.ok(tool, 'missing tool: slack_get_full_conversation');
  assert.equal(tool.annotations.readOnlyHint, false);
  assert.equal(tool.annotations.destructiveHint, false);
});

test('specific tool schemas match expectations', () => {
  const byName = new Map(TOOLS.map((t) => [t.name, t]));

  const history = byName.get('slack_conversations_history');
  assert.deepEqual(history.inputSchema.required, ['channel_id']);
  assert.equal(history.inputSchema.properties.channel_id.type, 'string');
  assert.equal(history.inputSchema.properties.limit.type, 'number');
  assert.equal(history.inputSchema.properties.resolve_users.type, 'boolean');

  const search = byName.get('slack_search_messages');
  assert.deepEqual(search.inputSchema.required, ['query']);
  assert.equal(search.inputSchema.properties.query.type, 'string');

  const send = byName.get('slack_send_message');
  assert.deepEqual(send.inputSchema.required, ['channel_id', 'text']);
  assert.equal(send.inputSchema.properties.thread_ts.type, 'string');
  assert.equal(send.annotations.idempotentHint, false);

  const thread = byName.get('slack_get_thread');
  assert.deepEqual(thread.inputSchema.required, ['channel_id', 'thread_ts']);

  const userInfo = byName.get('slack_users_info');
  assert.deepEqual(userInfo.inputSchema.required, ['user_id']);

  const fullConv = byName.get('slack_get_full_conversation');
  assert.deepEqual(fullConv.inputSchema.required, ['channel_id']);
  assert.equal(fullConv.inputSchema.properties.output_file.type, 'string');

  const listConvs = byName.get('slack_list_conversations');
  assert.equal(listConvs.inputSchema.properties.types.default, 'im,mpim');
  assert.equal(listConvs.inputSchema.properties.discover_dms.type, 'boolean');

  const tokenStatus = byName.get('slack_token_status');
  assert.deepEqual(Object.keys(tokenStatus.inputSchema.properties), []);

  const health = byName.get('slack_health_check');
  assert.deepEqual(Object.keys(health.inputSchema.properties), []);

  const refresh = byName.get('slack_refresh_tokens');
  assert.deepEqual(Object.keys(refresh.inputSchema.properties), []);

  const listUsers = byName.get('slack_list_users');
  assert.equal(listUsers.inputSchema.properties.limit.type, 'number');
});
