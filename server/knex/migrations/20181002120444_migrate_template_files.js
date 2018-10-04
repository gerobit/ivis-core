exports.up = (knex, Promise) => (async() =>  {
    await knex.schema.table('template_files', table => {
        table.dropColumn('encoding');
        table.renameColumn('template', 'entity');
    });

    await knex.schema.renameTable('template_files', 'files_template_file');
})();

exports.down = (knex, Promise) => (async() =>  {
})();
