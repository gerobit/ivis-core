exports.up = (knex, Promise) => (async() =>  {
    await knex.raw('SET FOREIGN_KEY_CHECKS=0');

    await knex.schema.table('template_files', table => {
        table.dropColumn('encoding');
        table.dropForeign('template');
        table.renameColumn('template', 'entity');
    });

    await knex.schema.renameTable('template_files', 'files_template_file');

    await knex.raw('SET FOREIGN_KEY_CHECKS=1');
})();

exports.down = (knex, Promise) => (async() =>  {
})();
