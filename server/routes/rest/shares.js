'use strict';

const passport = require('../../lib/passport');
const shares = require('../../models/shares');
const users = require('../../models/users');
const permissions = require('../../lib/permissions');
const knex = require('../../lib/knex');

const router = require('../../lib/router-async').create();

router.postAsync('/shares-table-by-entity/:entityTypeId/:entityId', passport.loggedIn, async (req, res) => {
    return res.json(await shares.listByEntityDTAjax(req.context, req.params.entityTypeId, req.params.entityId, req.body));
});

router.postAsync('/shares-table-by-user/:entityTypeId/:userId', passport.loggedIn, async (req, res) => {
    return res.json(await shares.listByUserDTAjax(req.context, req.params.entityTypeId, req.params.userId, req.body));
});

router.postAsync('/shares-unassigned-users-table/:entityTypeId/:entityId', passport.loggedIn, async (req, res) => {
    return res.json(await shares.listUnassignedUsersDTAjax(req.context, req.params.entityTypeId, req.params.entityId, req.body));
});

router.postAsync('/shares-roles-table/:entityTypeId', passport.loggedIn, async (req, res) => {
    return res.json(await shares.listRolesDTAjax(req.params.entityTypeId, req.body));
});

//FIXME: important
router.putAsync('/shares', passport.loggedIn, async (req, res) => {
    const body = req.body;
    await shares.assign(req.context, body.entityTypeId, body.entityId, body.userId, body.role);
    //For farm specific permission: sigset, sig
    if (body.entityTypeId === 'farm') {
        let role = body.role;
        /*if(body.role) this idea was probably wrong. I think so definitely wrong
            role = body.role;
        else {
            const user = users.getById(req.context, body.userId);
            role = user.role;
        }*/
        await knex.transaction(async tx => {
            //FIXME: maybe needed to add sharing check again here at farm level
            const sigSets = await tx.select(['sensor'])
                .from('farm_sensors').where('farm', body.entityId)
                //output [ { sensor: 32 }, { sensor: 33 }, { sensor: 35 } ]

            //console.log(sigSets);
            for (const sigSetId of sigSets) {
                //share signalSet to the userId with specified role, or its default role if it does not exist
                await shares.assign(req.context, 'signalSet', sigSetId.sensor, body.userId, role);
                //await tx('permissions_signal_set').where({ user: userId, entity: sigSetId.sensor }).del();

                const sigs = await tx.select(['id'])
                    .from('signals').where('set', sigSetId.sensor);
                //console.log(sigs);

                for (const sig of sigs) {
                    //share signal to the userId with specified role, or its default role if it doesnot exist
                    await shares.assign(req.context, 'signal', sig.id, body.userId, role)
                    //await tx('permissions_signal').where({ user: userId, entity: sig.id }).del();
                }
            }
        });
    }

    return res.json();
});

/*
 Checks if entities with a given permission exist.

 Accepts format:
 {
   XXX1: {
     entityTypeId: ...
     requiredOperations: [ ... ]
   },

   XXX2: {
     entityTypeId: ...
     requiredOperations: [ ... ]
   }
 }

 Returns:
 {
   XXX1: true
   XXX2: false
 }
 */
router.postAsync('/permissions-check', passport.loggedIn, async (req, res) => {
    const body = req.body;
    const result = {};

    for (const reqKey in body) {
        if (body[reqKey].entityId) {
            result[reqKey] = await shares.checkEntityPermission(req.context, body[reqKey].entityTypeId, body[reqKey].entityId, body[reqKey].requiredOperations);
        } else {
            result[reqKey] = await shares.checkTypePermission(req.context, body[reqKey].entityTypeId, body[reqKey].requiredOperations);
        }
    }

    return res.json(result);
});

router.postAsync('/permissions-rebuild', passport.loggedIn, async (req, res) => {
    shares.enforceGlobalPermission(req.context, 'rebuildPermissions');
    shares.rebuildPermissions();
    return res.json(result);
});



module.exports = router;