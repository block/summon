import { sandbox } from '@arrow-js/sandbox';

const target = globalThis as typeof globalThis & {
  __SUMMON_ARROW_SANDBOX__?: {
    sandbox: typeof sandbox;
  };
};

target.__SUMMON_ARROW_SANDBOX__ = Object.freeze({ sandbox });
