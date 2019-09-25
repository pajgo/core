import get = require('get-value')
import { Request, Server } from '@hapi/hapi'
import defaults = require('lodash/defaults')
import omit = require('lodash/omit')
import { HapiPlugin } from '..'
import { ActionTransport, Microfleet } from '../../../../..'
import verifyPossibility from '../../../../router/verifyAttachPossibility'
import { fromNameToPath, fromPathToName } from '../../../helpers/actionName'
import hapiRouterAdapter from './adapter'

export default function attachRouter(service: Microfleet, config: any): HapiPlugin {
  verifyPossibility(service.router, ActionTransport.http)
  const { http } = ActionTransport
  const { router } = service

  return {
    plugin: {
      name: 'microfleetRouter',
      version: '1.0.0',
      async register(server: Server) {
        for (const [actionName, handler] of Object.entries(service.router.routes.http)) {
          const path = fromNameToPath(actionName, config.prefix)
          const defaultOptions = {
            path,
            handler: hapiRouterAdapter(actionName, service),
            method: ['GET', 'POST'],
          }

          const hapiTransportOptions = get(<object>handler, 'transportOptions.handlers.hapi', Object.create(null))
          const handlerOptions = omit(hapiTransportOptions, ['path', 'handler'])

          server.route(defaults(handlerOptions, defaultOptions))
        }

        server.route({
          method: ['GET', 'POST'],
          path: '/{any*}',
          async handler(request: Request) {
            const actionName = fromPathToName(request.path, config.prefix)
            const handler = hapiRouterAdapter(actionName, service)
            return handler(request)
          },
        })

        /* Hapi not emitting request event */
        /* Using Extension */
        const onRequest = (_:any, h:any) => {
          router.requestCountTracker.increase(http)
          return h.continue
        }

        /* But emit's 'response' event */
        const onResponse = () => {
          router.requestCountTracker.decrease(http)
        }

        const onStop = () => {
          server.events.removeListener('response', onResponse)
        }

        server.ext('onRequest', onRequest)
        server.events.on('response', onResponse)
        server.events.on('stop', onStop)
      },
    },
  }
}
