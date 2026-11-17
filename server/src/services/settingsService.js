import { Setting } from '../models/Setting.js';

export const getSettings = async () => {
  let settings = await Setting.findOne({ key: 'global' });
  if (!settings) settings = await Setting.create({ key: 'global' });
  return settings;
};
