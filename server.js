const express = require('express');
const cors = require('cors');
const axios = require('axios');
const csv = require('csvtojson');

const app = express();
app.use(cors());
app.use(express.static('public'));


const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1-TmL67h-k9Vcxi4qiIfrrtovCY4hINYFwl-AfEDVXhI/export?format=csv&gid=876384911';

app.get('/api/data', async (req, res) => {
    try {
        const response = await axios.get(SHEET_URL);
        const rawCSV = response.data;

        // Split by lines and filter empty ones
        const allLines = rawCSV.split(/\r?\n/).filter(l => l.trim());

        // Find the line that actually looks like a header (contains ID or Full Name)
        // This is more robust than shift() which might skip the wrong line
        const headerIndex = allLines.findIndex(l => l.includes('ID') && l.includes('Full Name'));

        if (headerIndex === -1) {
            return res.status(500).json({ error: 'Could not find header row in CSV' });
        }

        const cleanCSV = allLines.slice(headerIndex).join('\n');
        const jsonArray = await csv().fromString(cleanCSV);
        res.json(jsonArray);
    } catch (error) {
        console.error("Error fetching or parsing CSV:", error.message);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});
