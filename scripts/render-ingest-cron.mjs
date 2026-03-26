const baseUrl = process.env.MMW_BASE_URL;
const ingestKey = process.env.INGEST_ADMIN_KEY || "";

if (!baseUrl) {
  console.error("Missing MMW_BASE_URL environment variable.");
  process.exit(1);
}

const endpoint = `${baseUrl.replace(/\/$/, "")}/api/admin/ingest`;

const run = async () => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ingest-key": ingestKey,
    },
    body: JSON.stringify({ includeSeed: false }),
  });

  const text = await response.text();

  if (!response.ok) {
    console.error(`Ingestion cron failed with ${response.status}: ${text}`);
    process.exit(1);
  }

  console.log(`Ingestion cron success: ${text}`);
};

run().catch((error) => {
  console.error("Ingestion cron execution error:", error);
  process.exit(1);
});
