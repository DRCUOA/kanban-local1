import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function noop() {
  /* suppress console output during tests */
}

describe('logger', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(noop);
    vi.spyOn(console, 'warn').mockImplementation(noop);
    vi.spyOn(console, 'error').mockImplementation(noop);
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = originalEnv;
    delete process.env.LOG_LEVEL;
  });

  async function loadLogger() {
    const mod = await import('./logger');
    return mod.logger;
  }

  describe('in development (default)', () => {
    it('debug logs are emitted', async () => {
      process.env.NODE_ENV = 'development';
      const logger = await loadLogger();
      logger.debug('test-debug');
      expect(console.log).toHaveBeenCalledWith('test-debug');
    });

    it('info logs are emitted', async () => {
      process.env.NODE_ENV = 'development';
      const logger = await loadLogger();
      logger.info('test-info');
      expect(console.log).toHaveBeenCalledWith('test-info');
    });

    it('warn logs are emitted', async () => {
      process.env.NODE_ENV = 'development';
      const logger = await loadLogger();
      logger.warn('test-warn');
      expect(console.warn).toHaveBeenCalledWith('test-warn');
    });

    it('error logs are emitted', async () => {
      process.env.NODE_ENV = 'development';
      const logger = await loadLogger();
      logger.error('test-error');
      expect(console.error).toHaveBeenCalledWith('test-error');
    });
  });

  describe('in production', () => {
    it('debug logs are suppressed', async () => {
      process.env.NODE_ENV = 'production';
      const logger = await loadLogger();
      logger.debug('should-not-appear');
      expect(console.log).not.toHaveBeenCalled();
    });

    it('info logs are emitted', async () => {
      process.env.NODE_ENV = 'production';
      const logger = await loadLogger();
      logger.info('prod-info');
      expect(console.log).toHaveBeenCalledWith('prod-info');
    });

    it('warn and error logs are emitted', async () => {
      process.env.NODE_ENV = 'production';
      const logger = await loadLogger();
      logger.warn('prod-warn');
      logger.error('prod-error');
      expect(console.warn).toHaveBeenCalledWith('prod-warn');
      expect(console.error).toHaveBeenCalledWith('prod-error');
    });
  });

  describe('LOG_LEVEL override', () => {
    it('only emits at or above the specified level', async () => {
      process.env.LOG_LEVEL = 'warn';
      const logger = await loadLogger();

      logger.debug('no');
      logger.info('no');
      expect(console.log).not.toHaveBeenCalled();

      logger.warn('yes');
      expect(console.warn).toHaveBeenCalledWith('yes');

      logger.error('yes');
      expect(console.error).toHaveBeenCalledWith('yes');
    });
  });

  describe('multiple arguments', () => {
    it('passes all arguments through', async () => {
      process.env.NODE_ENV = 'development';
      const logger = await loadLogger();
      logger.info('msg', { a: 1 }, 42);
      expect(console.log).toHaveBeenCalledWith('msg', { a: 1 }, 42);
    });
  });
});
