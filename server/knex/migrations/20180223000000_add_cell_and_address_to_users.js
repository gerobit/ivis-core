exports.up = (knex, Promise) => (async () => {
    await knex.schema.table('users', table => {
        table.string('cell');
        table.string('address');
      });
})();

exports.down = (knex, Promise) => (async () => {
})();