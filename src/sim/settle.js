/* ---------- settle: from marks to tiles ----------
   When the last god sleeps, the marks become a valley. Painters run in a fixed order, each reading marks and
   writing tiles. Settle runs outside the god stream: painting draws from the people's stream where resetState
   left it, so a seed's valley depends on its marks and its seed, never on how many ages the gods took. */
function settle(){
  log(`The last of the gods sleeps. The world is ${age} ages old, and holds its breath.`, [], 'major');
  creation.ages = age; creation.settled = true; creation.gate = restGate();
  paintSectors();
  paintGround();
  paintRivers();
  paintLakes();
  const best = placeFirstPerson();
  generateRest(best);
  era = 'days';
  const a = beings.find(b => b.species === 'human');
  log(`${a.name} walks alone into the ${sectorOfTile(tileAt(a.x, a.y)).name.toLowerCase()} with nothing but two hands.`, [a], 'major');
}
