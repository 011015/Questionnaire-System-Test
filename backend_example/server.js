
const express = require('express');
const app = express();
app.use(express.json());

let surveys = {
  "1": {
    id: "1",
    title: "Demo Survey",
    questions: [
      { id: "q1", type: "single", title: "Are you happy?", options: ["yes", "no"] }
    ]
  }
};

let state = {};

app.get('/survey/:id', (req, res) => {
  res.json(surveys[req.params.id]);
});

// ... other endpoints for survey management

app.listen(3000, () => console.log('Mock API running on 3000'));
