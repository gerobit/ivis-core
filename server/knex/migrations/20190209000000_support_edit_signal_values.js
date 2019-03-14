exports.up = (knex, Promise) => (async() =>  {
    await knex.schema.table('signals', table => {
        table.integer('weight_list').defaultTo(null);
        table.integer('weight_edit').defaultTo(null);
    });

    await knex.schema.table('signal_sets', table => {
        table.string('record_id_template').defaultTo(null);
    });
})();

exports.down = (knex, Promise) => (async() =>  {
})();
