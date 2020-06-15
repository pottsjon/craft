AccountsTemplates.removeField('email');
AccountsTemplates.removeField('password');
AccountsTemplates.addFields([
    {
    _id: 'username',
    type: 'text',
    displayName: "Username",
    required: true,
    minLength: 3
    },
    {
    _id: 'password',
    type: 'password',
    placeholder: {
        signUp: "At least six characters"
    },
    required: true,
    minLength: 6,
    re: /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/,
    errStr: 'At least 1 digit, 1 lowercase and 1 uppercase',
    }
]);
AccountsTemplates.configure({
    confirmPassword: false,
});