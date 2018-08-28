exports.up = (knex, Promise) => (async () => {
    await knex.raw('SET FOREIGN_KEY_CHECKS=0');

    await knex.schema.alterTable('users', table => {
        if(await knex.schema.hasColumn('users', 'cell') == false)
            table.string('cell');

        if(await knex.schema.hasColumn('users', 'address') == false)
            table.string('address');
      });

    await knex.raw('SET FOREIGN_KEY_CHECKS=1');
})();

exports.down = (knex, Promise) => (async () => {
    await knex.raw('SET FOREIGN_KEY_CHECKS=0');
    await knex.raw('SET FOREIGN_KEY_CHECKS=1');
})();