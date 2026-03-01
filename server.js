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

        // The first row is a title row, the second row contains headers. 
        // We will parse the CSV from the second row onwards.
        const rawCSV = response.data;
        const lines = rawCSV.split('\n');
        lines.shift(); // Remove the title row "🚀 Brendon AAA..."
        const cleanCSV = lines.join('\n');

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
