const express = require('express');
const client = require('prom-client');
const bodyParser = require('body-parser');
const app = express();

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const meterReadingsCounter = new client.Counter({
  name: 'meter_readings_total',
  help: 'Total number of meter readings received',
});

const meters = new Map();
app.use(bodyParser.json());


const tankLevel = new client.Gauge({
  name: 'tank_level',
  help: 'Current level of the tank',
  labelNames: ['tankName'],
});
register.registerMetric(tankLevel);


const previousLevels = {};

const tankVolume = new client.Gauge({
  name: 'tank_volume',
  help: 'Volume of liquid in the tank',
  labelNames: ['tankName'],
});
register.registerMetric(tankVolume);

const addedConsumptionGauge = new client.Gauge({
  name: 'tank_added_consumption',
  help: 'Added consumption of liquid in the tank',
  labelNames: ['tankName'],
});
register.registerMetric(addedConsumptionGauge);




app.post('/ht_meter', (req, res) => {
  const { meterName, previousReading, presentReading, factor, timestamp } = req.body;

  if (!meterName || previousReading === undefined || presentReading === undefined || factor === undefined || !timestamp) {
    return res.status(400).send('Missing required fields: meterName, previousReading, presentReading, factor, timestamp');
  }

  let meterGauge = meters.get(meterName);
  if (!meterGauge) {
    meterGauge = new client.Gauge({
      name: `ht_energy_meter_reading_${meterName}`,
      help: `Ht_Energy meter reading for ${meterName} in kWh`,
      labelNames: ['timestamp'],  
    });
    meters.set(meterName, meterGauge);
    register.registerMetric(meterGauge);
  }

  meterGauge.set({ timestamp }, presentReading - previousReading);
  meterReadingsCounter.inc();

  res.send('Reading recorded');
});




app.post('/building_readings', (req, res) => {
  const { meterName, reading, building,timestamp } = req.body;

  if (!meterName || reading === undefined || !building || !timestamp) {
    return res.status(400).send('Missing required fields: meterName, reading, timestamp');
  }

  // Create or update the gauge for the specific meter
  
  let meterGauge = meters.get(building);
  if (!meterGauge) {
    meterGauge = new client.Gauge({
      name: `${building}_energy_meter_reading`,
      help: `${building} Energy meter reading in kWh`,
      labelNames: ['meterName', 'building', 'timestamp'],
    });



    meters.set(building, meterGauge);
    register.registerMetric(meterGauge);
  }


  meterGauge.labels({ meterName, building, timestamp }).set(reading);


  res.send('Reading recorded');
});


app.post('/tank_level', (req, res) => {
  const { tankName, level, date } = req.body;

  if (!tankName || level === undefined || !date) {
    return res.status(400).send('Missing required fields: tankName, level, date');
  }

  tankLevel.labels(tankName).set(level);
  res.send('Tank level recorded');
});





app.post('/tank_volume', (req, res) => {
  const { tankName, diameter, level, date } = req.body;

  if (!tankName || diameter === undefined || level === undefined || !date) {
    return res.status(400).send('Missing required fields: tankName, diameter, level, date');
  }

  const radius = diameter / 2;
  const volume = Math.PI * Math.pow(radius, 2) * level;
  let addedConsumption = 0;
  if (previousLevels[tankName] !== undefined) {
    const previousVolume = Math.PI * Math.pow(radius, 2) * previousLevels[tankName];
    addedConsumption = volume - previousVolume;
  }
  previousLevels[tankName] = level;

  tankVolume.labels(tankName).set(volume);
  
  addedConsumptionGauge.labels(tankName).set(addedConsumption);

  res.send('Tank volume and added consumption recorded');



});



app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});



const port = 8000;
app.listen(port, () => {
  console.log(`Energy meter exporter listening at http://localhost:${port}`);
  console.log(port)
});


module.exports=app
