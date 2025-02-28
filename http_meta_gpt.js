/*
 * HTTP Meta GPT Check Script for Sub-Store
 * URL: https://raw.githubusercontent.com/xream/scripts/main/surge/modules/sub-store-scripts/check/http_meta_gpt.js
 * Parameters: timeout=1000&retries=1&retry_delay=1000&concurrency=10&client=iOS&http_meta_protocol=http&http_meta_host=127.0.0.1&http_meta_port=9876&http_meta_start_delay=3000&http_meta_proxy_timeout=10000
 */

(async () => {
  const $ = $substore;
  const { http } = $.utils;

  // Parse parameters from script URL
  const params = $.parseArgs($script.resource);
  const timeout = parseInt(params.timeout) || 1000;
  const retries = parseInt(params.retries) || 1;
  const retryDelay = parseInt(params.retry_delay) || 1000;
  const concurrency = parseInt(params.concurrency) || 10;
  const client = params.client || "iOS";
  const protocol = params.http_meta_protocol || "http";
  const host = params.http_meta_host || "127.0.0.1";
  const port = parseInt(params.http_meta_port) || 9876;
  const startDelay = parseInt(params.http_meta_start_delay) || 3000;
  const proxyTimeout = parseInt(params.http_meta_proxy_timeout) || 10000;

  // HTTP Meta endpoint
  const metaUrl = `${protocol}://${host}:${port}/check`;

  // Function to check GPT availability
  async function checkGPT(node) {
    try {
      const response = await http({
        method: "GET",
        url: metaUrl,
        timeout: proxyTimeout,
        headers: { "User-Agent": client },
        proxy: {
          host: node.host,
          port: node.port,
          protocol: node.protocol,
        },
      });
      return response.status === 200 && response.data.success;
    } catch (error) {
      return false;
    }
  }

  // Process nodes with concurrency
  const nodes = $.nodes;
  const results = await $.utils.concurrent(
    nodes,
    async (node) => {
      await $.utils.sleep(startDelay); // Initial delay
      let success = false;
      for (let i = 0; i < retries; i++) {
        success = await checkGPT(node);
        if (success) break;
        if (i < retries - 1) await $.utils.sleep(retryDelay);
      }
      node._gpt = success; // Add _gpt field to node
      return node;
    },
    concurrency
  );

  // Output processed nodes
  $.done(results);
})();
