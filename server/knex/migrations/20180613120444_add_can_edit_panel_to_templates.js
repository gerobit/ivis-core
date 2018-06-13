
exports.up = (knex, Promise) => (async() =>  {
    await knex.schema.table('templates', table => {
        table.boolean('can_edit_panel').defaultTo(false).notNullable();
    });
})();

exports.down = (knex, Promise) => (async() =>  {
})();
