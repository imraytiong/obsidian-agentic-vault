import google from 'googlethis';
async function run() {
    try {
        const results = await google.search('obsidian app');
        console.log(JSON.stringify(results, null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
