exports.up = (knex, Promise) => (async () => {
    await knex.raw('SET FOREIGN_KEY_CHECKS=0');

    await knex.schema.alterTable('signal_sets', table => {
        table.dateTime('last_update');
        table.integer('update_period').unsigned();
    });

    await knex.raw('SET FOREIGN_KEY_CHECKS=1');
})();

exports.down = (knex, Promise) => (async () => {
    await knex.raw('SET FOREIGN_KEY_CHECKS=0');
    await knex.raw('SET FOREIGN_KEY_CHECKS=1');
})();