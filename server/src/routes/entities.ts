import { Router } from 'express';
import type { Env } from '../lib/env.js';
import { authenticate } from '../middleware/auth.js';
import { EntityService } from '../services/entity-service.js';

export const entitiesRouter = (env: Env) => {
  const router = Router({ mergeParams: true });
  const requireAuth = authenticate(env);
  const service = new EntityService(env);

  router.get('/:entity', requireAuth, async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const params = service.parseListParams(req);
      const data = await service.list(req.params.entity, params, req.user);
      return res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:entity/:id', requireAuth, async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const data = await service.get(req.params.entity, req.params.id, req.user);
      return res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.post('/:entity', requireAuth, async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const data = await service.create(req.params.entity, req.body ?? {}, req.user);
      return res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  });

  router.put('/:entity/:id', requireAuth, async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const data = await service.update(req.params.entity, req.params.id, req.body ?? {}, req.user);
      return res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:entity/:id', requireAuth, async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const data = await service.remove(req.params.entity, req.params.id, req.user);
      return res.json(data);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
