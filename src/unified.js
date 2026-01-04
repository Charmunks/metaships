const API_URL = 'https://api2.hackclub.com/v0.1/Unified%20YSWS%20Projects%20DB/YSWS%20Programs/';

async function fetchPrograms() {
  const response = await fetch(API_URL);
  const programs = await response.json();
  return programs.filter(p => (p.fields['Unweighted–Total'] || 0) > 0);
}

async function getEvents() {
  const programs = await fetchPrograms();
  return programs.map(program => program.fields.Name);
}

async function getShips(eventName) {
  const programs = await fetchPrograms();
  const program = programs.find(p => p.fields.Name === eventName);
  return program ? program.fields['Unweighted–Total'] : null;
}

module.exports = { getEvents, getShips };
