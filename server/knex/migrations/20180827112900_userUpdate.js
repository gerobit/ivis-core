exports.up = (knex, Promise) => (async () => {
    await knex.schema.table('users', table => {
        table.renameColumn('cell', 'phone_cell');
    });
})();

exports.down = (knex, Promise) => (async () => {
})();