import streamlit as st

st.title("Login")

email = st.text_input("Email")

if st.button("Login"):
    if not email:
        st.error("Please enter your email")
    else:
        st.session_state.user_email = email
        st.success("Logged in successfully")
        st.switch_page("app.py")
