
exports.up = (knex, Promise) => (async() =>  {
    // FIXME
    const sigSets = await knex('signal_sets').where('aggs', true);
    for (const sigSet of sigSets) {
        const sigs = await knex('signals').where('set', sigSet.id);
        await knex.schema.table(`signal_set_${sigSet.cid}`, table => {
            table.dropColumn('first_ts');
            table.dropColumn('last_ts');
            for (const sig of sigs) {
                table.dropColumn('min_' + sig.cid);
                table.dropColumn('max_' + sig.cid);
                table.renameColumn('avg_' + sig.cid, 'val_' + sig.cid);
            }
        });
    }

    await knex.schema.table('signal_sets', table => {
        table.dropColumn('aggs');
    });
})();

exports.down = (knex, Promise) => (async() =>  {
})();
