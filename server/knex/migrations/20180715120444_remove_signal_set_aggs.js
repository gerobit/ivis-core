
exports.up = (knex, Promise) => (async() =>  {
    // FIXME
    const sigSets = await knex('signal_sets').where('aggs', true);
    for (const sigSet of sigSets) {
        const signals = await knex('signals').where('set', sigSet.id);
        await knex.schema.table('signals', table => {
            for (const signal of signals) {
                table.dropColumn('min_' + signal.cid);
                table.dropColumn('max_' + signal.cid);
                table.renameColumn('avg_' + + signal.cid, 'val_' + signal.cid);
            }
        });
    }

    await knex.schema.table('signal_sets', table => {
        table.dropColumn('aggs');
    });
})();

exports.down = (knex, Promise) => (async() =>  {
})();
