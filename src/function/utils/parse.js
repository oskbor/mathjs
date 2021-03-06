(function () {
    /**
     * Parse an expression. Returns a node tree, which can be evaluated by
     * invoking node.eval();
     *
     * Syntax:
     *
     *     math.parse(expr)
     *     math.parse(expr, scope)
     *     math.parse([expr1, expr2, expr3, ...])
     *     math.parse([expr1, expr2, expr3, ...], scope)
     *
     * Example:
     *
     *     var node = math.parse('sqrt(3^2 + 4^2)');
     *     node.eval(); // 5
     *
     *     var scope = {a:3, b:4}
     *     var node = math.parse('a * b', scope); // 12
     *     node.eval(); // 12
     *     scope.a = 5;
     *     node.eval(); // 20
     *
     *     var nodes = math.parse(['a = 3', 'b = 4', 'a * b']);
     *     nodes[2].eval(); // 12
     *
     * @param {String | String[] | Matrix} expr
     * @param {math.expr.Scope | Object} [scope]
     * @return {Node | Node[]} node
     * @throws {Error}
     */
    math.parse = function (expr, scope) {
        if (arguments.length != 1 && arguments.length != 2) {
            throw newArgumentsError('parse', arguments.length, 1, 2);
        }

        // instantiate a scope
        var parseScope;
        if (scope) {
            if (scope instanceof math.expr.Scope) {
                parseScope = scope;
            }
            else {
                parseScope = new math.expr.Scope(scope);
            }
        }
        else {
            parseScope = new math.expr.Scope();
        }

        if (isString(expr)) {
            // parse a single expression
            expression = expr || '';
            return parse_start(parseScope);
        }
        else if (expr instanceof Array || expr instanceof Matrix) {
            // parse an array or matrix with expressions
            return util.map(expr, function (elem) {
                expression = elem || '';
                return parse_start(parseScope);
            });
        }
        else {
            // oops
            throw new TypeError('String or matrix expected');
        }
    };

    // token types enumeration
    var TOKENTYPE = {
        NULL : 0,
        DELIMITER : 1,
        NUMBER : 2,
        SYMBOL : 3,
        UNKNOWN : 4
    };

    var expression = '';  // current expression
    var index = 0;        // current index in expr
    var c = '';           // current token character in expr
    var token = '';       // current token
    var token_type = TOKENTYPE.NULL; // type of the token

    /**
     * Get the next character from the expression.
     * The character is stored into the char t.
     * If the end of the expression is reached, the function puts an empty
     * string in t.
     * @private
     */
    function getChar() {
        index++;
        c = expression.charAt(index);
    }

    /**
     * Get the first character from the expression.
     * The character is stored into the char t.
     * If the end of the expression is reached, the function puts an empty
     * string in t.
     * @private
     */
    function getFirstChar() {
        index = 0;
        c = expression.charAt(0);
    }

    /**
     * Get next token in the current string expr.
     * Uses the Parser data expr, e, token, t, token_type and err
     * The token and token type are available at token_type and token
     * @private
     */
    function getToken() {
        token_type = TOKENTYPE.NULL;
        token = '';

        // skip over whitespaces
        while (c == ' ' || c == '\t') {  // space or tab
            getChar();
        }

        // skip comment
        if (c == '#') {
            while (c != '\n' && c != '') {
                getChar();
            }
        }

        // check for end of expression
        if (c == '') {
            // token is still empty
            token_type = TOKENTYPE.DELIMITER;
            return;
        }

        // check for factorial character !, and unequal operator !=
        if (c == '!') {
            token_type = TOKENTYPE.DELIMITER;
            token += c;
            getChar();

            // TODO: solve operators consisting of of two characters in a more generic way
            if (c == '=') {
                token += c;
                getChar();
            }

            return;
        }

        // check for minus, comma, parentheses, quotes, newline, semicolon
        if (c == '-' || c == ',' ||
            c == '(' || c == ')' ||
            c == '[' || c == ']' ||
            c == '\"' || c == '\'' ||
            c == '\n' ||
            c == ';' || c == ':') {
            token_type = TOKENTYPE.DELIMITER;
            token += c;
            getChar();
            return;
        }

        // check for operators (delimiters)
        if (isDelimiter(c)) {
            token_type = TOKENTYPE.DELIMITER;
            while (isDelimiter(c)) {
                token += c;
                getChar();
            }
            return;
        }

        // check for a number
        if (isDigitDot(c)) {
            token_type = TOKENTYPE.NUMBER;

            // get number, can have a single dot
            if (c == '.') {
                token += c;
                getChar();

                if (!isDigit(c)) {
                    // this is no legal number, it is just a dot
                    token_type = TOKENTYPE.UNKNOWN;
                }
            }
            else {
                while (isDigit(c)) {
                    token += c;
                    getChar();
                }
                if (c == '.') {
                    token += c;
                    getChar();
                }
            }
            while (isDigit(c)) {
                token += c;
                getChar();
            }

            // check for scientific notation like "2.3e-4" or "1.23e50"
            if (c == 'E' || c == 'e') {
                token += c;
                getChar();

                if (c == '+' || c == '-') {
                    token += c;
                    getChar();
                }

                // Scientific notation MUST be followed by an exponent
                if (!isDigit(c)) {
                    // this is no legal number, exponent is missing.
                    token_type = TOKENTYPE.UNKNOWN;
                }

                while (isDigit(c)) {
                    token += c;
                    getChar();
                }
            }

            return;
        }

        // check for variables or functions
        if (isAlpha(c)) {
            token_type = TOKENTYPE.SYMBOL;

            while (isAlpha(c) || isDigit(c))
            {
                token += c;
                getChar();
            }
            return;
        }

        // something unknown is found, wrong characters -> a syntax error
        token_type = TOKENTYPE.UNKNOWN;
        while (c != '') {
            token += c;
            getChar();
        }
        throw createSyntaxError('Syntax error in part "' + token + '"');
    }

    /**
     * checks if the given char c is a delimiter
     * minus is not checked in this method (can be unary minus)
     * @param {String} c   a string with one character
     * @return {Boolean}
     * @private
     */
    function isDelimiter (c) {
        return c == '&' ||
            c == '|' ||
            c == '<' ||
            c == '>' ||
            c == '=' ||
            c == '+' ||
            c == '/' ||
            c == '*' ||
            c == '%' ||
            c == '^' ||
            c == ',' ||
            c == ';' ||
            c == '\n' ||
            c == '!' ||
            c == '\'';
    }

    /**
     * Check if a given name is valid
     * if not, an error is thrown
     * @param {String} name
     * @return {boolean} valid
     * @private
     */
    function isValidSymbolName (name) {
        for (var i = 0, iMax = name.length; i < iMax; i++) {
            var c = name.charAt(i);
            //var valid = (isAlpha(c) || (i > 0 && isDigit(c))); // TODO: allow digits in symbol name
            var valid = (isAlpha(c));
            if (!valid) {
                return false;
            }
        }

        return true;
    }

    /**
     * checks if the given char c is a letter (upper or lower case)
     * or underscore
     * @param {String} c   a string with one character
     * @return {Boolean}
     * @private
     */
    function isAlpha (c) {
        return ((c >= 'a' && c <= 'z') ||
            (c >= 'A' && c <= 'Z') ||
            c == '_');
    }

    /**
     * checks if the given char c is a digit or dot
     * @param {String} c   a string with one character
     * @return {Boolean}
     * @private
     */
    function isDigitDot (c) {
        return ((c >= '0' && c <= '9') ||
            c == '.');
    }

    /**
     * checks if the given char c is a digit
     * @param {String} c   a string with one character
     * @return {Boolean}
     * @private
     */
    function isDigit (c) {
        return ((c >= '0' && c <= '9'));
    }

    /**
     * Start of the parse levels below, in order of precedence
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_start (scope) {
        // get the first character in expression
        getFirstChar();

        getToken();

        var node;
        if (token == '') {
            // empty expression
            node = new ConstantNode(undefined);
        }
        else {
            node = parse_block(scope);
        }

        // check for garbage at the end of the expression
        // an expression ends with a empty character '' and token_type DELIMITER
        if (token != '') {
            if (token_type == TOKENTYPE.DELIMITER) {
                // user entered a not existing operator like "//"

                // TODO: give hints for aliases, for example with "<>" give as hint " did you mean != ?"
                throw createError('Unknown operator ' + token);
            }
            else {
                throw createSyntaxError('Unexpected part "' + token + '"');
            }
        }

        return node;
    }

    /**
     * Parse a block with expressions. Expressions can be separated by a newline
     * character '\n', or by a semicolon ';'. In case of a semicolon, no output
     * of the preceding line is returned.
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_block (scope) {
        var node, block, visible;

        if (token != '\n' && token != ';' && token != '') {
            node = parse_ans(scope);
        }

        while (token == '\n' || token == ';') {
            if (!block) {
                // initialize the block
                block = new BlockNode();
                if (node) {
                    visible = (token != ';');
                    block.add(node, visible);
                }
            }

            getToken();
            if (token != '\n' && token != ';' && token != '') {
                node = parse_ans(scope);

                visible = (token != ';');
                block.add(node, visible);
            }
        }

        if (block) {
            return block;
        }

        if (!node) {
            node = parse_ans(scope);
        }

        return node;
    }

    /**
     * Parse assignment of ans.
     * Ans is assigned when the expression itself is no variable or function
     * assignment
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_ans (scope) {
        var expression = parse_function_assignment(scope);

        // create a variable definition for ans
        var name = 'ans';
        return new AssignmentNode(name, expression, scope);
    }

    /**
     * Parse a function assignment like "function f(a,b) = a*b"
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_function_assignment (scope) {
        // TODO: keyword 'function' must become a reserved keyword
        if (token_type == TOKENTYPE.SYMBOL && token == 'function') {
            // get function name
            getToken();
            if (token_type != TOKENTYPE.SYMBOL) {
                throw createSyntaxError('Function name expected');
            }
            var name = token;

            // get parenthesis open
            getToken();
            if (token != '(') {
                throw createSyntaxError('Opening parenthesis ( expected');
            }

            // get function variables
            var functionScope = scope.createSubScope();
            var variables = [];
            while (true) {
                getToken();
                if (token_type == TOKENTYPE.SYMBOL) {
                    // store variable name
                    variables.push(token);
                }
                else {
                    throw createSyntaxError('Variable name expected');
                }

                getToken();
                if (token == ',') {
                    // ok, nothing to do, read next variable
                }
                else if (token == ')') {
                    // end of variable list encountered. break loop
                    break;
                }
                else {
                    throw createSyntaxError('Comma , or closing parenthesis ) expected"');
                }
            }

            getToken();
            if (token != '=') {
                throw createSyntaxError('Equal sign = expected');
            }

            // parse the expression, with the correct function scope
            getToken();
            var expression = parse_assignment(functionScope);

            return new FunctionNode(name, variables, expression, functionScope, scope);
        }

        return parse_assignment(scope);
    }

    /**
     * Assignment of a variable, can be a variable like "a=2.3" or a updating an
     * existing variable like "matrix(2,3:5)=[6,7,8]"
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_assignment (scope) {
        var name, params, paramScopes, expr;

        /* TODO: cleanup? or use? see comments further down
         var linkExisted = false;
         if (token_type == TOKENTYPE.SYMBOL) {
         linkExisted = scope.has(token);
         }
         */

        var node = parse_range(scope);

        if (token == '=') {
            if (node instanceof SymbolNode) {
                // TODO: remove link when it was undefined before we parsed this expression?
                // we parsed the assignment as if it where an expression instead,
                // therefore, a link was created to the symbol. This link must
                // be cleaned up again, and only if it wasn't existing before

                // parse the expression, with the correct function scope
                getToken();
                name = node.name;
                params = null;
                expr = parse_assignment(scope);
                return new AssignmentNode(name, expr, scope);
            }
            else if (node instanceof ParamsNode && node.object instanceof SymbolNode) {
                // TODO: remove link when it was undefined before we parsed this expression?
                // we parsed the assignment as if it where an expression instead,
                // therefore, a link was created to the symbol. This link must
                // be cleaned up again, and only if it wasn't existing before

                // parse the expression, with the correct function scope
                getToken();
                name = node.object.name;
                params = node.params;
                paramScopes = node.paramScopes;
                expr = parse_assignment(scope);
                return new UpdateNode(name, params, paramScopes, expr, scope);
            }
            else {
                throw createSyntaxError('Symbol expected at the left hand side ' +
                    'of assignment operator =');
            }
        }

        return node;
    }

    /**
     * parse range, "start:end", "start:step:end", ":", "start:", ":end", etc
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_range (scope) {
        var node, name, fn, params = [];

        if (token == ':') {
            // implicit start=1
            node = new ConstantNode(1);
        }
        else {
            // explicit start
            node = parse_conditions(scope);
        }

        if (token == ':') {
            params.push(node);

            // parse step and end
            while (token == ':') {
                getToken();
                if (token == ')' || token == ',' || token == '') {
                    // implicit end
                    params.push(new SymbolNode('end', scope));
                }
                else {
                    // explicit end
                    params.push(parse_conditions(scope));
                }
            }

            if (params.length) {
                // create a range constructor
                name = 'range';
                fn = math.range;
                node = new OperatorNode(name, fn, params);
            }
        }

        return node;
    }

    /**
     * conditions like and, or, in
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_conditions (scope) {
        var node, operators, name, fn, params;

        node = parse_bitwise_conditions(scope);

        // TODO: precedence of And above Or?
        // TODO: implement a method for unit to number conversion
        operators = {
            'in' : 'in'
            /* TODO: implement conditions
             'and' : 'and',
             '&&' : 'and',
             'or': 'or',
             '||': 'or',
             'xor': 'xor'
             */
        };

        while (operators[token] !== undefined) {
            name = token;
            fn = math[operators[name]];

            getToken();
            params = [node, parse_bitwise_conditions(scope)];
            node = new OperatorNode(name, fn, params);
        }

        return node;
    }

    /**
     * conditional operators and bitshift
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_bitwise_conditions (scope) {
        var node = parse_comparison(scope);

        /* TODO: implement bitwise conditions
         var operators = {
         '&' : 'bitwiseand',
         '|' : 'bitwiseor',
         // todo: bitwise xor?
         '<<': 'bitshiftleft',
         '>>': 'bitshiftright'
         };
         while (operators[token] !== undefined) {
         var name = token;
         var fn = math[operators[name]];

         getToken();
         var params = [node, parse_comparison()];
         node = new OperatorNode(name, fn, params);
         }
         */

        return node;
    }

    /**
     * comparison operators
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_comparison (scope) {
        var node, operators, name, fn, params;

        node = parse_addsubtract(scope);

        operators = {
            '==': 'equal',
            '!=': 'unequal',
            '<': 'smaller',
            '>': 'larger',
            '<=': 'smallereq',
            '>=': 'largereq'
        };
        while (operators[token] !== undefined) {
            name = token;
            fn = math[operators[name]];

            getToken();
            params = [node, parse_addsubtract(scope)];
            node = new OperatorNode(name, fn, params);
        }

        return node;
    }

    /**
     * add or subtract
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_addsubtract (scope)  {
        var node, operators, name, fn, params;

        node = parse_multiplydivide(scope);

        operators = {
            '+': 'add',
            '-': 'subtract'
        };
        while (operators[token] !== undefined) {
            name = token;
            fn = math[operators[name]];

            getToken();
            params = [node, parse_multiplydivide(scope)];
            node = new OperatorNode(name, fn, params);
        }

        return node;
    }

    /**
     * multiply, divide, modulus
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_multiplydivide (scope) {
        var node, operators, name, fn, params;

        node = parse_unaryminus(scope);

        operators = {
            '*': 'multiply',
            '/': 'divide',
            '%': 'mod',
            'mod': 'mod'
        };

        while (operators[token] !== undefined) {
            name = token;
            fn = math[operators[name]];

            getToken();
            params = [node, parse_unaryminus(scope)];
            node = new OperatorNode(name, fn, params);
        }

        return node;
    }

    /**
     * Unary minus
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_unaryminus (scope) {
        var name, fn, params;

        if (token == '-') {
            name = token;
            fn = math.unaryminus;
            getToken();
            params = [parse_pow(scope)];

            return new OperatorNode(name, fn, params);
        }

        return parse_pow(scope);
    }

    /**
     * power
     * Node: power operator is right associative
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_pow (scope) {
        var node, leftNode, nodes, operators, name, fn, params;

        nodes = [
            parse_factorial(scope)
        ];

        // stack all operands of a chained power operator (like '2^3^3')
        while (token == '^') {
            getToken();
            nodes.push(parse_factorial(scope));
        }

        // evaluate the operands from right to left (right associative)
        node = nodes.pop();
        while (nodes.length) {
            leftNode = nodes.pop();
            name = '^';
            fn = math.pow;
            params = [leftNode, node];
            node = new OperatorNode(name, fn, params);
        }

        return node;
    }

    /**
     * Factorial
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_factorial (scope)  {
        var node, name, fn, params;

        node = parse_transpose(scope);

        while (token == '!') {
            name = token;
            fn = math.factorial;
            getToken();
            params = [node];

            node = new OperatorNode(name, fn, params);
        }

        return node;
    }

    /**
     * Transpose
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_transpose (scope)  {
        var node, name, fn, params;

        node = parse_plot(scope);

        while (token == '\'') {
            name = token;
            fn = math.transpose;
            getToken();
            params = [node];

            node = new OperatorNode(name, fn, params);
        }

        return node;
    }

    /**
     * parse plot
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_plot (scope) {
        /* TODO: implement plot
         if (token_type == TOKENTYPE.SYMBOL &&
         token == 'plot') {
         getToken();

         // parse the parentheses and parameters of the plot
         // the parameters are something like: plot(sin(x), cos(x), x)
         var functions = [];
         if (token == '(') {
         var plotScope = scope.createSubScope();

         getToken();
         functions.push(parse_assignment(plotScope));

         // parse a list with parameters
         while (token == ',') {
         getToken();
         functions.push(parse_assigment(plotScope));
         }

         if (token != ')') {
         throw createSyntaxError('Parenthesis ) missing');
         }
         getToken();
         }

         // check what the variable of the functions is.
         var variable = undefined;
         var lastFunction = functions[functions.length - 1];
         if (lastFunction) {
         // if the last function is a variable, remove it from the functions list
         // and use its variable func
         var lastIsSymbol = (lastFunction instanceof Arguments);
         if (lastIsSymbol) {
         functions.pop();
         variable = lastFunction.fn;
         }
         }
         return new plot(functions, variable, plotScope);
         }
         */

        return parse_symbol(scope);
    }

    /**
     * parse symbols: functions, variables, constants, units
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_symbol (scope) {
        var node, name;

        if (token_type == TOKENTYPE.SYMBOL) {
            name = token;

            getToken();

            // create a symbol
            node = new SymbolNode(name, scope);

            // parse parameters
            return parse_params(scope, node);
        }

        return parse_string(scope);
    }

    /**
     * parse parameters, enclosed in parenthesis
     * @param {math.expr.Scope} scope
     * @param {Node} node    Node on which to apply the parameters. If there
     *                       are no parameters in the expression, the node
     *                       itself is returned
     * @return {Node} node
     * @private
     */
    function parse_params (scope, node) {
        var params,
            paramScopes,
            paramScope;

        while (token == '(') {
            params = [];
            paramScopes = [];

            getToken();

            if (token != ')') {
                paramScope = scope.createSubScope();
                paramScopes.push(paramScope);
                params.push(parse_range(paramScope));

                // parse a list with parameters
                while (token == ',') {
                    getToken();

                    paramScope = scope.createSubScope();
                    paramScopes.push(paramScope);
                    params.push(parse_range(paramScope));
                }
            }

            if (token != ')') {
                throw createSyntaxError('Parenthesis ) missing');
            }
            getToken();

            node = new ParamsNode(node, params, paramScopes);
        }

        return node;
    }

    /**
     * parse a string.
     * A string is enclosed by double quotes
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_string (scope) {
        var node, str, tPrev;

        if (token == '"') {
            // string "..."
            str = '';
            tPrev = '';
            while (c != '' && (c != '\"' || tPrev == '\\')) { // also handle escape character
                str += c;
                tPrev = c;
                getChar();
            }

            getToken();
            if (token != '"') {
                throw createSyntaxError('End of string " missing');
            }
            getToken();

            // create constant
            node = new ConstantNode(str);

            // parse parameters
            node = parse_params(scope, node);

            return node;
        }

        return parse_matrix(scope);
    }

    /**
     * parse the matrix
     * @param {math.expr.Scope} scope
     * @return {Node} A MatrixNode
     * @private
     */
    function parse_matrix (scope) {
        var array, params, r, c, rows, cols;

        if (token == '[') {
            // matrix [...]

            // skip newlines
            getToken();
            while (token == '\n') {
                getToken();
            }

            // check if this is an empty matrix "[ ]"
            if (token != ']') {
                // this is a non-empty matrix
                params = [];
                r = 0;
                c = 0;

                params[0] = [parse_assignment(scope)];

                // the columns in the matrix are separated by commas, and the rows by dot-comma's
                while (token == ',' || token == ';') {
                    if (token == ',') {
                        c++;
                    }
                    else {
                        r++;
                        c = 0;
                        params[r] = [];
                    }

                    // skip newlines
                    getToken();
                    while (token == '\n') {
                        getToken();
                    }

                    params[r][c] = parse_assignment(scope);

                    // skip newlines
                    while (token == '\n') {
                        getToken();
                    }
                }

                rows =  params.length;
                cols = (params.length > 0) ? params[0].length : 0;

                // check if the number of columns matches in all rows
                for (r = 1; r < rows; r++) {
                    if (params[r].length != cols) {
                        throw createError('Number of columns must match ' +
                            '(' + params[r].length + ' != ' + cols + ')');
                    }
                }

                if (token != ']') {
                    throw createSyntaxError('End of matrix ] missing');
                }

                getToken();
                array = new MatrixNode(params);
            }
            else {
                // this is an empty matrix "[ ]"
                getToken();
                array = new MatrixNode([[]]);
            }

            // parse parameters
            array = parse_params(scope, array);

            return array;
        }

        return parse_number(scope);
    }

    /**
     * parse a number
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_number (scope) {
        var node, value, number;

        if (token_type == TOKENTYPE.NUMBER) {
            // this is a number
            if (token == '.') {
                number = 0;
            } else {
                number = Number(token);
            }
            getToken();

            /* TODO: implicit multiplication?
             // TODO: how to calculate a=3; 2/2a ? is this (2/2)*a or 2/(2*a) ?
             // check for implicit multiplication
             if (token_type == TOKENTYPE.VARIABLE) {
             node = multiply(node, parse_pow());
             }
             //*/

            if (token_type == TOKENTYPE.SYMBOL) {
                if (token == 'i' || token == 'I') {
                    value = new Complex(0, number);
                    getToken();
                    return new ConstantNode(value);
                }

                if (Unit.isPlainUnit(token)) {
                    value = new Unit(number, token);
                    getToken();
                    return new ConstantNode(value);
                }

                throw createTypeError('Unknown unit "' + token + '"');
            }

            // just a regular number
            node = new ConstantNode(number);

            // parse parameters
            node = parse_params(scope, node);

            return node;
        }

        return parse_parentheses(scope);
    }

    /**
     * parentheses
     * @param {math.expr.Scope} scope
     * @return {Node} node
     * @private
     */
    function parse_parentheses (scope) {
        var node;

        // check if it is a parenthesized expression
        if (token == '(') {
            // parentheses (...)
            getToken();
            node = parse_assignment(scope); // start again

            if (token != ')') {
                throw createSyntaxError('Parenthesis ) expected');
            }
            getToken();

            /* TODO: implicit multiplication?
             // TODO: how to calculate a=3; 2/2a ? is this (2/2)*a or 2/(2*a) ?
             // check for implicit multiplication
             if (token_type == TOKENTYPE.VARIABLE) {
             node = multiply(node, parse_pow());
             }
             //*/

            // parse parameters
            node = parse_params(scope, node);

            return node;
        }

        return parse_end(scope);
    }

    /**
     * Evaluated when the expression is not yet ended but expected to end
     * @param {math.expr.Scope} scope
     * @return {Node} res
     * @private
     */
    function parse_end (scope) {
        if (token == '') {
            // syntax error or unexpected end of expression
            throw createSyntaxError('Unexpected end of expression');
        } else {
            throw createSyntaxError('Value expected');
        }
    }

    /**
     * Shortcut for getting the current row value (one based)
     * Returns the line of the currently handled expression
     * @private
     */
    function row () {
        // TODO: also register row number during parsing
        return undefined;
    }

    /**
     * Shortcut for getting the current col value (one based)
     * Returns the column (position) where the last token starts
     * @private
     */
    function col () {
        return index - token.length + 1;
    }

    /**
     * Build up an error message
     * @param {String} message
     * @return {String} message with row and column information
     * @private
     */
    function createErrorMessage (message) {
        var r = row();
        var c = col();
        if (r === undefined) {
            if (c === undefined) {
                return message;
            } else {
                return message + ' (char ' + c + ')';
            }
        } else {
            return message + ' (line ' + r + ', char ' + c + ')';
        }
    }

    /**
     * Create an error
     * @param {String} message
     * @return {SyntaxError} instantiated error
     * @private
     */
    function createSyntaxError (message) {
        return new SyntaxError(createErrorMessage(message));
    }

    /**
     * Create an error
     * @param {String} message
     * @return {TypeError} instantiated error
     * @private
     */
    function createTypeError(message) {
        return new TypeError(createErrorMessage(message));
    }

    /**
     * Create an error
     * @param {String} message
     * @return {Error} instantiated error
     * @private
     */
    function createError (message) {
        return new Error(createErrorMessage(message));
    }

})();
