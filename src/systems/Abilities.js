export const ABILITIES = [
  {
    id: 'nova',
    name: 'NOVA BURST',
    short: 'NOVA',
    key: 'KeyQ',
    keyLabel: 'Q',
    cooldown: 10,
    color: '#b06bff',
    icon: 'N'
  },
  {
    id: 'shield',
    name: 'AEGIS FIELD',
    short: 'AEGIS',
    key: 'KeyE',
    keyLabel: 'E',
    cooldown: 16,
    color: '#59ffa8',
    icon: 'A'
  },
  {
    id: 'overdrive',
    name: 'OVERDRIVE',
    short: 'DRIVE',
    key: 'KeyR',
    keyLabel: 'R',
    cooldown: 20,
    color: '#ffc857',
    icon: 'O'
  },
  {
    id: 'timewarp',
    name: 'TIME WARP',
    short: 'WARP',
    key: 'KeyC',
    keyLabel: 'C',
    cooldown: 24,
    color: '#46f4ff',
    icon: 'T'
  }
];

export const ABILITY_BY_KEY = {};
for (let i = 0; i < ABILITIES.length; i++) {
  ABILITY_BY_KEY[ABILITIES[i].key] = ABILITIES[i].id;
}
