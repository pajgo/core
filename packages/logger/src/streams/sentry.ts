import assert = require('assert')
import { Writable } from 'stream'
import { Streams, Level } from 'pino-multi-stream'
import * as Sentry from '@sentry/node'
import * as Integrations from '@sentry/integrations'
import * as Parsers from '@sentry/node/dist/parsers'
import readPkgUp = require('read-pkg-up')
import lsmod = require('lsmod')

// keys to be banned
const BAN_LIST = {
  msg: true,
  time: true,
  hostname: true,
  name: true,
  level: true,
}

const {
  extractStackFromError,
  parseStack,
  prepareFramesForEvent,
} = Parsers

/**
 * Sentry stream for Pino
 */
class SentryStream extends Writable {
  private release: string
  private env?: string = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV
  private modules?: any = lsmod()

  constructor(opts: any) {
    super()
    this.release = opts.release
    // @ts-ignore
    this[Symbol.for('pino.metadata')] = true
  }

  /**
   * Method call by Pino to save log record
   * msg is a stringified set of data
   */
  public write(msg: string) {
    const event = JSON.parse(msg)
    const extra = Object.create(null)

    for (const [key, value] of Object.entries<any>(event)) {
      // @ts-ignore
      if (BAN_LIST[key] === true) continue
      extra[key] = value
    }

    (async () => {
      let stacktrace = undefined
      if (event.err && event.err.stack) {
        try {
          const stack = extractStackFromError(event.err)
          const frames = await parseStack(stack)
          stacktrace = { frames: prepareFramesForEvent(frames) }
        } catch (e) { /* ignore */ }
      }
      Sentry.captureEvent({
        extra,
        stacktrace,
        message: event.msg,
        timestamp: event.time / 1e3,
        level: this.getSentryLevel(event.level),
        platform: 'node',
        server_name: event.hostname,
        logger: event.name,
        release: this.release,
        environment: this.env,
        sdk: {
          name: Sentry.SDK_NAME,
          version: Sentry.SDK_VERSION,
        },
        modules: this.modules,
        fingerprint: ['{{ default }}'],
      })
    })()

    return true
  }

  /**
   * Error deserialiazing function. Bunyan serialize the error to object:
   * https://github.com/trentm/node-bunyan/blob/master/lib/bunyan.js#L1089
   * @param  {object} data serialized Bunyan
   * @return {Error}      the deserialiazed error
   */
  deserializeError(data: any): any {
    if (data instanceof Error) return data

    const error = new Error(data.message) as any
    error.name = data.name
    error.stack = data.stack
    error.code = data.code
    error.signal = data.signal
    return error
  }

  /**
   * Convert Bunyan level number to Sentry level label.
   * Rule : >50=error ; 40=warning ; info otherwise
   */
  getSentryLevel(level: number): Sentry.Severity {
    if (level >= 50) return Sentry.Severity.Error
    if (level === 40) return Sentry.Severity.Warning

    return Sentry.Severity.Info
  }
}

type SentryOpts = Sentry.NodeOptions & {
  level: Level
}

function sentryStreamFactory(config: SentryOpts): Streams[0] {
  const { level = 'error', ...rest } = config

  assert(rest.dsn, '"dsn" property must be set')

  Sentry.init({
    ...rest,
    defaultIntegrations: false,
    ...process.env.NODE_ENV === 'test' && {
      integrations: [
        new Integrations.Debug(),
      ],
    },
  })

  const release = readPkgUp.sync({ cwd: process.cwd() }).pkg.version

  return {
    level,
    stream: new SentryStream({ release }),
  }
}

export default sentryStreamFactory
