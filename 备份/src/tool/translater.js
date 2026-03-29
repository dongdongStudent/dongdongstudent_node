const fs = require('fs');
const path = require('path');

class Translater {
    fun_6 = (data) => { // 返回目录结构
        console.log('fun_6', data);
        var d_id = 1
        const decodedString = decodeURIComponent(data); // 解码
        var a = traverseDirectory(decodedString)
        return a

        // 功能函数

        function traverseDirectory(dirPath) {
            let children = [];
            const files = fs.readdirSync(dirPath); // 读取目录中的所有文件名

            const sortedChildren = files.sort((a, b) => {
                const int_a = a.match(/\d*(?=--)/)[0];
                const int_b = b.match(/\d*(?=--)/)[0];

                if (parseInt(int_a) < parseInt(int_b)) return -1;
                if (parseInt(int_a) > parseInt(int_b)) return 1;
                return 0;
            });

            sortedChildren.forEach((file, index) => {
                const filePath = path.join(dirPath, file);
                const stat = fs.statSync(filePath);

                if (stat.isDirectory()) {
                    const child = {
                        title: file,
                        key: filePath,
                        children: traverseDirectory(filePath),
                    };
                    children.push(child);
                }
                else {
                    const child = {
                        id: d_id,
                        title: file,
                        key: filePath,
                    };
                    d_id++;
                    children.push(child);
                }
            });

            return children;
        }

    }

    get_translater_index = () => { // 返回翻译文件内容
        try {
            const path_file = path.join(__dirname, '../..', `resource/common/text/translate_word_index.js`); // 设置保存路径
            let my_movies = require(path_file); // 读取数据
            if (my_movies) {
                return my_movies;
            } else {
                return null;
            }
        } catch (err) {
            console.error("Translater", err);
        }
    }
}

module.exports = Translater;
