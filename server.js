app.use(express.json({ limit: "1mb" }));
app.use("/assets", express.static(join(__dirname, "assets")));

function requireDatabaseConfig() {
