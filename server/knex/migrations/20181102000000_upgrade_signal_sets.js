const { SignalType } = require('../../../shared/signals');

exports.up = (knex, Promise) => (async() =>  {
    await knex.schema.table('signals', table => {
        table.boolean('indexed').defaultTo(false);
    });

    const sigSets = await knex('signal_sets');

    for (const sigSet of sigSets) {
        const tblName = `signal_set_${sigSet.id}`;
        await knex.schema.renameTable(`signal_set_${sigSet.cid}`, tblName);

        const sigs = await knex('signals').where('set', sigSet.id);

        const ids = await knex('signals').insert({
            cid: 'ts',
            name: 'Timestamp',
            type: SignalType.DATE_TIME,
            set: sigSet.id,
            namespace: sigSet.namespace
        });

        const tsId = ids[0];
        const tsCol = 's' + tsId;

        await knex.schema.raw('ALTER TABLE `' + tblName + '` ADD `id` VARCHAR(255) CHARACTER SET ascii FIRST');

        await knex.schema.table(tblName, table => {
            table.renameColumn('ts', tsCol);
            for (const sig of sigs) {
                table.renameColumn('val_' + sig.cid, 's' + sig.id);
            }
        });

        // Creates ids as 2018-01-12T16:17:46.123Z - this corresponds to moment.toISOString()
        await knex(tblName).update('id', knex.raw("CONCAT(DATE_FORMAT(`" + tsCol + "`, '%Y-%m-%dT%H:%i:%s.'),LPAD(MICROSECOND(`" + tsCol + "`) DIV 1000, 3, '0'),'Z')"));

        // Note that this removes duplicates (by ts)
        await knex.schema.raw('ALTER IGNORE TABLE `' + tblName + '` MODIFY `id` VARCHAR(255) CHARACTER SET ascii NOT NULL PRIMARY KEY');
    }
})();

exports.down = (knex, Promise) => (async() =>  {
})();
